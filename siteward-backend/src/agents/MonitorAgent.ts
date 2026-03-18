import axios from 'axios';
import { saveScanResult, createIssue, resolveStaleIssues } from '../db';
import * as cheerio from 'cheerio';

export class MonitorAgent {
  private websiteUrl: string;
  private websiteId: string;

  constructor(websiteUrl: string, websiteId: string) {
    this.websiteUrl = websiteUrl;
    this.websiteId = websiteId;
  }

  async scan() {
    try {
      console.log(`[MonitorAgent] Scanning ${this.websiteUrl}`);
      const source = 'monitor_agent';
      const activeIssueFingerprints = new Set<string>();

      const issues: string[] = [];
      const data: Record<string, any> = {
        timestamp: new Date().toISOString(),
        url: this.websiteUrl,
      };

      // ── 1. Uptime & TTFB ──────────────────────────────────────────────────
      const t0 = Date.now();
      let siteResponse: any;
      try {
        siteResponse = await axios.get(this.websiteUrl, {
          timeout: 15000,
          maxRedirects: 5,
          headers: { 'User-Agent': 'SiteWard-Monitor/1.0' },
        });
      } catch (err: any) {
        const statusCode = err.response?.status || 0;
        data.statusCode = statusCode;
        data.uptime = false;
        data.error = err.message;
        issues.push(`Site is unreachable or returned HTTP ${statusCode || 'error'}`);
        const fp = 'monitor:site-unreachable';
        activeIssueFingerprints.add(fp);

        await createIssue(
          this.websiteId,
          'monitor',
          'critical',
          'Site Unreachable',
          `The site returned an error: ${err.message}`,
          { statusCode, error: err.message },
          { source, fingerprint: fp }
        );

        await saveScanResult(this.websiteId, 'monitor', 'error', data, issues);
        return { status: 'error', issues, data };
      }

      const ttfb = Date.now() - t0;
      data.statusCode = siteResponse.status;
      data.uptime = true;
      data.ttfb = ttfb; // ms
      data.pageSize = Buffer.byteLength(siteResponse.data, 'utf8'); // bytes
      data.redirected = siteResponse.request?.res?.responseUrl !== this.websiteUrl;

      if (ttfb > 3000) {
        issues.push(`Slow response time: ${ttfb}ms (target < 3000ms)`);
        const fp = 'monitor:slow-ttfb';
        activeIssueFingerprints.add(fp);
        await createIssue(
          this.websiteId,
          'performance',
          'high',
          'Slow Time to First Byte',
          `TTFB is ${ttfb}ms. Aim for under 600ms; 3000ms will hurt Core Web Vitals.`,
          { ttfb, threshold: 3000 },
          { source, fingerprint: fp }
        );
      } else if (ttfb > 1500) {
        issues.push(`Elevated response time: ${ttfb}ms`);
      }

      if (siteResponse.status >= 400) {
        issues.push(`Site returned HTTP ${siteResponse.status}`);
      }

      // ── 2. Broken Links ───────────────────────────────────────────────────
      const brokenLinks = await this.checkBrokenLinks(siteResponse.data);
      if (brokenLinks.length > 0) {
        issues.push(`Found ${brokenLinks.length} broken link(s)`);
        data.brokenLinks = brokenLinks;

        for (const link of brokenLinks) {
          const fp = `monitor:broken-link:${link.url}`;
          activeIssueFingerprints.add(fp);
          await createIssue(
            this.websiteId,
            'broken_link',
            link.statusCode >= 500 ? 'high' : 'medium',
            `Broken link: ${link.url}`,
            `The link returned HTTP ${link.statusCode || 'timeout/no response'}`,
            { url: link.url, statusCode: link.statusCode },
            { source, fingerprint: fp }
          );
        }
      }

      // ── 3. Core Web Vitals (real TTFB, estimated LCP from page size) ──────
      const cwv = this.estimateCoreWebVitals(ttfb, data.pageSize);
      data.coreWebVitals = cwv;
      if (cwv.lcpEstimate > 4000) {
        issues.push('Estimated LCP may exceed 4s (large page size)');
      }

      // ── 4. Page weight check ──────────────────────────────────────────────
      const pageSizeKB = Math.round(data.pageSize / 1024);
      data.pageSizeKB = pageSizeKB;
      if (pageSizeKB > 500) {
        issues.push(`Large HTML page: ${pageSizeKB}KB (target < 500KB)`);
      }

      await resolveStaleIssues(this.websiteId, source, Array.from(activeIssueFingerprints));

      await saveScanResult(
        this.websiteId,
        'monitor',
        issues.length === 0 ? 'success' : 'warning',
        data,
        issues,
        { ttfb, pageSizeKB }
      );

      return {
        status: issues.length === 0 ? 'success' : 'warning',
        issues,
        data,
      };
    } catch (error) {
      console.error('[MonitorAgent] Error:', error);
      return {
        status: 'error',
        issues: ['Failed to scan website'],
        error: (error as Error).message,
      };
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async checkBrokenLinks(html: string) {
    const brokenLinks: { url: string; statusCode: number }[] = [];

    try {
      const $ = cheerio.load(html);
      const hrefs: string[] = [];

      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

        // Resolve relative URLs
        try {
          const resolved = new URL(href, this.websiteUrl).toString();
          if (!hrefs.includes(resolved)) hrefs.push(resolved);
        } catch {
          // skip malformed
        }
      });

      // Check at most 15 links (to stay within reasonable time)
      const sample = hrefs.slice(0, 15);
      const checks = sample.map(async (url) => {
        try {
          const res = await axios.head(url, {
            timeout: 6000,
            headers: { 'User-Agent': 'SiteWard-Monitor/1.0' },
            validateStatus: () => true, // don't throw on 4xx/5xx
            maxRedirects: 3,
          });
          if (res.status >= 400) {
            return { url, statusCode: res.status };
          }
        } catch {
          return { url, statusCode: 0 };
        }
        return null;
      });

      const results = await Promise.all(checks);
      for (const r of results) {
        if (r) brokenLinks.push(r as { url: string; statusCode: number });
      }
    } catch (err) {
      console.error('[MonitorAgent] Link check error:', err);
    }

    return brokenLinks;
  }

  /**
   * Estimate CWV from measurable signals (TTFB + page size).
   * Real LCP requires a headless browser — these are indicative estimates.
   */
  private estimateCoreWebVitals(ttfb: number, pageSizeBytes: number) {
    // Rule of thumb: each 100KB of HTML adds ~100ms of parse/render time
    const parseTimeEstimate = (pageSizeBytes / 1024 / 100) * 100;
    const lcpEstimate = Math.round(ttfb + parseTimeEstimate);

    return {
      ttfb,
      lcpEstimate,
      note: 'LCP is an estimate based on TTFB + HTML size. Use Lighthouse for precise values.',
      rating: lcpEstimate < 2500 ? 'good' : lcpEstimate < 4000 ? 'needs-improvement' : 'poor',
    };
  }
}
