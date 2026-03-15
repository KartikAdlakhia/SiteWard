import axios from 'axios';
import { supabase, saveScanResult, createIssue } from '../db';
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
      
      const issues: string[] = [];
      const data: Record<string, any> = {
        timestamp: new Date().toISOString(),
        url: this.websiteUrl,
      };

      // Check if site is accessible
      const siteResponse = await axios.get(this.websiteUrl, { timeout: 10000 });
      data.statusCode = siteResponse.status;

      // Check for broken links
      const brokenLinks = await this.checkBrokenLinks(siteResponse.data);
      if (brokenLinks.length > 0) {
        issues.push(`Found ${brokenLinks.length} broken links`);
        data.brokenLinks = brokenLinks;
      }

      // Check Core Web Vitals (simulated - in production use real measurement)
      const cwv = await this.checkCoreWebVitals();
      data.coreWebVitals = cwv;
      if (cwv.lcp > 2500 || cwv.cls > 0.1 || cwv.fid > 100) {
        issues.push('Core Web Vitals need improvement');
      }

      // Check for content changes (screenshot diff simulation)
      data.visualRegression = await this.detectVisualChanges();

      await saveScanResult(
        this.websiteId,
        'monitor',
        issues.length === 0 ? 'success' : 'warning',
        data,
        issues
      );

      // Create issues in database
      for (const issue of brokenLinks) {
        await createIssue(
          this.websiteId,
          'broken_link',
          'medium',
          `Broken link: ${issue.url}`,
          `Status code: ${issue.statusCode}`,
          { url: issue.url, statusCode: issue.statusCode }
        );
      }

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

  private async checkBrokenLinks(html: string) {
    const links: string[] = [];
    const brokenLinks = [];

    try {
      // Parse HTML and extract links
      const $ = cheerio.load(html);
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          links.push(href);
        }
      });

      // Check each link (sample check, limit to 10 for free tier)
      const sampleLinks = links.slice(0, 10);
      for (const link of sampleLinks) {
        try {
          const response = await axios.head(link, { timeout: 5000 });
          if (response.status >= 400) {
            brokenLinks.push({ url: link, statusCode: response.status });
          }
        } catch {
          brokenLinks.push({ url: link, statusCode: 0 });
        }
      }
    } catch (error) {
      console.error('Link checking error:', error);
    }

    return brokenLinks;
  }

  private async checkCoreWebVitals() {
    // Simulated CWV - in production, use real measurement from real browser
    return {
      lcp: Math.random() * 4000, // Largest Contentful Paint
      cls: Math.random() * 0.2, // Cumulative Layout Shift
      fid: Math.random() * 300, // First Input Delay (deprecated, use INP)
      ttfb: Math.random() * 1000, // Time to First Byte
    };
  }

  private async detectVisualChanges() {
    // Simulated visual regression detection
    // In production, use Puppeteer for actual screenshots
    return {
      changed: Math.random() > 0.7,
      changePercentage: Math.random() * 100,
    };
  }
}
