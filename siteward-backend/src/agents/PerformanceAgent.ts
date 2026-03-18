import axios from 'axios';
import { saveScanResult, createIssue, resolveStaleIssues } from '../db';
import * as cheerio from 'cheerio';

export class PerformanceAgent {
  private websiteUrl: string;
  private websiteId: string;

  constructor(websiteUrl: string, websiteId: string) {
    this.websiteUrl = websiteUrl;
    this.websiteId = websiteId;
  }

  async scan() {
    try {
      console.log(`[PerformanceAgent] Analyzing ${this.websiteUrl}`);
      const source = 'performance_agent';
      const activeIssueFingerprints = new Set<string>();

      const issues: string[] = [];
      const data: Record<string, any> = {
        timestamp: new Date().toISOString(),
        url: this.websiteUrl,
      };

      // Fetch the page
      const t0 = Date.now();
      let html = '';
      let headers: Record<string, string> = {};
      try {
        const res = await axios.get(this.websiteUrl, {
          timeout: 15000,
          headers: { 'User-Agent': 'SiteWard-Perf/1.0' },
        });
        html = res.data;
        headers = res.headers as Record<string, string>;
        data.fetchTime = Date.now() - t0;
      } catch (err: any) {
        data.error = err.message;
        issues.push('Could not fetch page for performance analysis');
        await saveScanResult(this.websiteId, 'performance', 'error', data, issues);
        return { status: 'error', issues, data };
      }

      const $ = cheerio.load(html);

      // ── 1. SSL Check ─────────────────────────────────────────────────────
      const ssl = this.checkSSL(this.websiteUrl);
      data.ssl = ssl;
      if (!ssl.isHttps) {
        issues.push('Site is not served over HTTPS');
        const fp = 'perf:no-https';
        activeIssueFingerprints.add(fp);
        await createIssue(
          this.websiteId, 'security', 'critical',
          'No HTTPS',
          'The site is served over HTTP. All sites should use HTTPS to protect user data.',
          ssl,
          { source, fingerprint: fp }
        );
      }

      // ── 2. Compression check ──────────────────────────────────────────────
      const encoding = headers['content-encoding'] || '';
      data.compression = { encoding, compressed: !!encoding };
      if (!encoding) {
        issues.push('HTTP response is not compressed (gzip/br recommended)');
        const fp = 'perf:no-compression';
        activeIssueFingerprints.add(fp);
        await createIssue(
          this.websiteId, 'performance', 'medium',
          'No HTTP Compression',
          'Enable gzip or Brotli compression to reduce page transfer size.',
          { encoding: 'none' },
          { source, fingerprint: fp }
        );
      }

      // ── 3. Caching headers ────────────────────────────────────────────────
      const cacheControl = headers['cache-control'] || '';
      const hasCache = !!cacheControl && !cacheControl.includes('no-store');
      data.caching = { cacheControl, hasCache };
      if (!hasCache) {
        issues.push('No cache-control headers — browsers cannot cache the page');
        const fp = 'perf:missing-cache-control';
        activeIssueFingerprints.add(fp);
        await createIssue(
          this.websiteId, 'performance', 'low',
          'Missing Cache-Control Headers',
          'Add Cache-Control headers to let browsers cache static resources.',
          { cacheControl },
          { source, fingerprint: fp }
        );
      }

      // ── 4. Image analysis ─────────────────────────────────────────────────
      const imageAnalysis = await this.analyzeImages($, html);
      data.images = imageAnalysis;
      if (imageAnalysis.unoptimized.length > 0) {
        issues.push(`${imageAnalysis.unoptimized.length} image(s) could be optimised (no lazy-load / wrong format)`);
        const fp = 'perf:unoptimized-images';
        activeIssueFingerprints.add(fp);
        await createIssue(
          this.websiteId, 'performance', 'medium',
          `${imageAnalysis.unoptimized.length} Unoptimised Image(s)`,
          `Images without lazy loading or in non-modern formats: ${imageAnalysis.unoptimized.slice(0, 3).join(', ')}`,
          { images: imageAnalysis.unoptimized },
          { source, fingerprint: fp }
        );
      }

      // ── 5. Render-blocking resources ──────────────────────────────────────
      const blocking = this.checkBlockingResources($);
      data.blocking = blocking;
      if (blocking.blockingScripts > 0) {
        issues.push(`${blocking.blockingScripts} render-blocking <script> tag(s) in <head>`);
        const fp = 'perf:render-blocking-scripts';
        activeIssueFingerprints.add(fp);
        await createIssue(
          this.websiteId, 'performance', 'medium',
          'Render-Blocking Scripts',
          `${blocking.blockingScripts} synchronous scripts in <head> delay page rendering. Use defer or async.`,
          blocking,
          { source, fingerprint: fp }
        );
      }

      // ── 6. Page weight ────────────────────────────────────────────────────
      const pageSizeKB = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
      data.pageSizeKB = pageSizeKB;
      if (pageSizeKB > 500) {
        issues.push(`HTML page is large: ${pageSizeKB}KB (aim for < 500KB)`);
      }

      // ── 7. Inline script / style bloat ───────────────────────────────────
      const inlineStyles = $('style').length;
      const inlineScripts = $('script:not([src])').length;
      data.inline = { inlineStyles, inlineScripts };
      if (inlineStyles + inlineScripts > 10) {
        issues.push(`${inlineStyles + inlineScripts} inline style/script blocks detected (prefer external files)`);
      }

      await resolveStaleIssues(this.websiteId, source, Array.from(activeIssueFingerprints));

      await saveScanResult(
        this.websiteId,
        'performance',
        issues.length === 0 ? 'success' : 'warning',
        data,
        issues,
        { pageSizeKB, compressed: !!encoding }
      );

      return {
        status: issues.length === 0 ? 'success' : 'warning',
        issues,
        data,
      };
    } catch (error) {
      console.error('[PerformanceAgent] Error:', error);
      return {
        status: 'error',
        issues: ['Failed to analyse performance'],
        error: (error as Error).message,
      };
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private checkSSL(url: string) {
    try {
      const parsed = new URL(url);
      return { isHttps: parsed.protocol === 'https:', protocol: parsed.protocol };
    } catch {
      return { isHttps: false, error: 'Invalid URL' };
    }
  }

  private async analyzeImages($: cheerio.CheerioAPI, html: string) {
    const unoptimized: string[] = [];
    let total = 0;

    $('img').each((_, el) => {
      total++;
      const src = $(el).attr('src') || '';
      const loading = $(el).attr('loading');
      const srcset = $(el).attr('srcset');

      // Flag if no lazy loading AND no srcset (old-style)
      const isLazyLoaded = loading === 'lazy';
      const isModernFormat = src.endsWith('.webp') || src.endsWith('.avif');

      if (!isLazyLoaded && !srcset && !isModernFormat && src) {
        unoptimized.push(src);
      }
    });

    return {
      total,
      unoptimized: unoptimized.slice(0, 20), // cap list
      unoptimizedCount: unoptimized.length,
    };
  }

  private checkBlockingResources($: cheerio.CheerioAPI) {
    let blockingScripts = 0;
    let deferredScripts = 0;
    let asyncScripts = 0;

    $('head script').each((_, el) => {
      const defer = $(el).attr('defer');
      const asyncAttr = $(el).attr('async');
      const src = $(el).attr('src');
      if (src) { // external scripts only
        if (defer !== undefined) { deferredScripts++; }
        else if (asyncAttr !== undefined) { asyncScripts++; }
        else { blockingScripts++; }
      }
    });

    let blockingStyles = 0;
    $('head link[rel="stylesheet"]').each((_, el) => {
      const media = $(el).attr('media');
      if (!media || media === 'all') blockingStyles++;
    });

    return { blockingScripts, deferredScripts, asyncScripts, blockingStyles };
  }
}
