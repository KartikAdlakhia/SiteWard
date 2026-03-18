import axios from 'axios';
import { saveScanResult, createIssue, resolveStaleIssues } from '../db';
import * as cheerio from 'cheerio';

// Security headers every site should have
const REQUIRED_HEADERS: Record<string, { severity: 'low' | 'medium' | 'high' | 'critical'; description: string }> = {
  'strict-transport-security': {
    severity: 'high',
    description: 'HSTS is missing. Browsers cannot enforce HTTPS for future visits.',
  },
  'content-security-policy': {
    severity: 'high',
    description: 'No Content-Security-Policy. The site is vulnerable to XSS and injection attacks.',
  },
  'x-content-type-options': {
    severity: 'medium',
    description: 'X-Content-Type-Options header is missing. Enable nosniff to prevent MIME-type sniffing.',
  },
  'x-frame-options': {
    severity: 'medium',
    description: 'X-Frame-Options header is missing. The site may be embeddable in iframes (clickjacking risk).',
  },
  'referrer-policy': {
    severity: 'low',
    description: 'Referrer-Policy header is missing. User navigation data may leak to third parties.',
  },
  'permissions-policy': {
    severity: 'low',
    description: 'Permissions-Policy header missing. Consider restricting camera/mic/geolocation APIs.',
  },
};

// Patterns that may indicate hardcoded secrets in the HTML source
const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp; severity: 'high' | 'critical' }> = [
  { name: 'Stripe Live Key',     pattern: /sk_live_[A-Za-z0-9]{24,}/,        severity: 'critical' },
  { name: 'AWS Access Key',      pattern: /AKIA[0-9A-Z]{16}/,                 severity: 'critical' },
  { name: 'GitHub Token',        pattern: /ghp_[A-Za-z0-9_]{36}/,            severity: 'critical' },
  { name: 'Generic API Key',     pattern: /api[_-]?key["']?\s*[:=]\s*["'][A-Za-z0-9_-]{20,}/i, severity: 'high' },
  { name: 'Private Key Header',  pattern: /-----BEGIN (RSA|EC|PRIVATE) KEY/, severity: 'critical' },
  { name: 'Firebase Config',     pattern: /apiKey:\s*["'][A-Za-z0-9_-]{30,}["']/, severity: 'high' },
];

// Patterns that may indicate XSS-prone code in the HTML
const XSS_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'eval() usage',               pattern: /\beval\s*\(/g },
  { name: 'document.write() usage',     pattern: /document\.write\s*\(/g },
  { name: 'innerHTML assignment',        pattern: /\.innerHTML\s*=/g },
  { name: 'Unencoded URL param in DOM', pattern: /location\.(search|hash)\s*[^=]?=/g },
];

export class SecurityAgent {
  private websiteUrl: string;
  private websiteId: string;

  constructor(websiteUrl: string, websiteId: string) {
    this.websiteUrl = websiteUrl;
    this.websiteId = websiteId;
  }

  async scan() {
    try {
      console.log(`[SecurityAgent] Scanning ${this.websiteUrl}`);
      const source = 'security_agent';
      const activeIssueFingerprints = new Set<string>();

      const issues: string[] = [];
      const data: Record<string, any> = {
        timestamp: new Date().toISOString(),
        url: this.websiteUrl,
      };

      // Fetch page and headers
      let html = '';
      let responseHeaders: Record<string, string> = {};
      let finalUrl = this.websiteUrl;
      try {
        const res = await axios.get(this.websiteUrl, {
          timeout: 15000,
          maxRedirects: 5,
          headers: { 'User-Agent': 'SiteWard-Security/1.0' },
          validateStatus: () => true,
        });
        html = res.data;
        responseHeaders = res.headers as Record<string, string>;
        finalUrl = res.request?.res?.responseUrl || this.websiteUrl;
      } catch (err: any) {
        data.error = err.message;
        issues.push('Could not fetch page for security analysis');
        await saveScanResult(this.websiteId, 'security', 'error', data, issues);
        return { status: 'error', issues, data };
      }

      // ── 1. HTTPS enforcement ─────────────────────────────────────────────
      const httpsCheck = this.checkHTTPS(this.websiteUrl, finalUrl);
      data.https = httpsCheck;
      if (!httpsCheck.isHttps) {
        issues.push('Site not served over HTTPS');
        const fp = 'security:not-https';
        activeIssueFingerprints.add(fp);
        await createIssue(
          this.websiteId, 'security', 'critical',
          'Site Is Not on HTTPS',
          'All traffic should be served over HTTPS to protect data integrity and user privacy.',
          httpsCheck,
          { source, fingerprint: fp }
        );
      }
      if (!httpsCheck.redirectsToHttps && httpsCheck.isHttps === false) {
        issues.push('HTTP does not redirect to HTTPS');
      }

      // ── 2. Security headers (real header check) ──────────────────────────
      const headerResults = this.checkSecurityHeaders(responseHeaders);
      data.securityHeaders = headerResults;
      for (const missing of headerResults.missing) {
        const meta = REQUIRED_HEADERS[missing.toLowerCase()];
        if (meta) {
          issues.push(`Missing header: ${missing}`);
          const fp = `security:missing-header:${missing.toLowerCase()}`;
          activeIssueFingerprints.add(fp);
          await createIssue(
            this.websiteId, 'security', meta.severity,
            `Missing Security Header: ${missing}`,
            meta.description,
            { header: missing },
            { source, fingerprint: fp }
          );
        }
      }

      // ── 3. Exposed secrets in source ─────────────────────────────────────
      const exposed = this.scanForSecrets(html);
      data.exposedSecrets = exposed;
      for (const secret of exposed) {
        issues.push(`Possible exposed secret: ${secret.name}`);
        const fp = `security:exposed-secret:${secret.name.toLowerCase()}`;
        activeIssueFingerprints.add(fp);
        await createIssue(
          this.websiteId, 'security', secret.severity,
          `Possible Exposed Secret: ${secret.name}`,
          `A pattern matching "${secret.name}" was found in the page source. Remove credentials from client-side code immediately.`,
          { secretType: secret.name },
          { source, fingerprint: fp }
        );
      }

      // ── 4. XSS-prone patterns in inline scripts ────────────────────────
      const xss = this.scanForXSS(html);
      data.xssPatterns = xss;
      if (xss.length > 0) {
        issues.push(`${xss.length} potential XSS-prone pattern(s) detected in source`);
        const fp = 'security:xss-patterns-detected';
        activeIssueFingerprints.add(fp);
        await createIssue(
          this.websiteId, 'security', 'high',
          'XSS-Prone Code Patterns Detected',
          `Found patterns that may allow cross-site scripting: ${xss.map(x => x.name).join(', ')}`,
          { patterns: xss },
          { source, fingerprint: fp }
        );
      }

      // ── 5. Mixed content check ─────────────────────────────────────────
      if (httpsCheck.isHttps) {
        const mixed = this.checkMixedContent(html);
        data.mixedContent = mixed;
        if (mixed.count > 0) {
          issues.push(`${mixed.count} mixed-content resource(s) loaded over HTTP on an HTTPS page`);
          const fp = 'security:mixed-content-detected';
          activeIssueFingerprints.add(fp);
          await createIssue(
            this.websiteId, 'security', 'medium',
            'Mixed Content Detected',
            `${mixed.count} resource(s) are loaded via HTTP on an HTTPS page. Browsers may block them.`,
            mixed,
            { source, fingerprint: fp }
          );
        }
      }

      // ── 6. External script domains ────────────────────────────────────
      const $ = cheerio.load(html);
      const externalScripts = this.listExternalScripts($);
      data.externalScripts = externalScripts;
      await resolveStaleIssues(this.websiteId, source, Array.from(activeIssueFingerprints));

      await saveScanResult(
        this.websiteId,
        'security',
        issues.length === 0 ? 'success' : 'warning',
        data,
        issues
      );

      return {
        status: issues.length === 0 ? 'success' : 'warning',
        issues,
        data,
      };
    } catch (error) {
      console.error('[SecurityAgent] Error:', error);
      return {
        status: 'error',
        issues: ['Failed to scan security'],
        error: (error as Error).message,
      };
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private checkHTTPS(requestedUrl: string, finalUrl: string) {
    try {
      const parsed = new URL(requestedUrl);
      const finalParsed = new URL(finalUrl);
      return {
        isHttps: finalParsed.protocol === 'https:',
        redirectsToHttps: parsed.protocol === 'http:' && finalParsed.protocol === 'https:',
        protocol: finalParsed.protocol,
      };
    } catch {
      return { isHttps: false, redirectsToHttps: false, protocol: 'unknown' };
    }
  }

  private checkSecurityHeaders(headers: Record<string, string>) {
    const lowerHeaders = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
    );

    const present: string[] = [];
    const missing: string[] = [];

    for (const header of Object.keys(REQUIRED_HEADERS)) {
      if (lowerHeaders[header]) {
        present.push(header);
      } else {
        missing.push(header);
      }
    }

    return {
      present,
      missing,
      allPresent: missing.length === 0,
      score: Math.round((present.length / Object.keys(REQUIRED_HEADERS).length) * 100),
    };
  }

  private scanForSecrets(html: string) {
    const found: Array<{ name: string; severity: 'high' | 'critical' }> = [];
    for (const { name, pattern, severity } of SECRET_PATTERNS) {
      if (pattern.test(html)) {
        found.push({ name, severity });
      }
    }
    return found;
  }

  private scanForXSS(html: string) {
    const found: Array<{ name: string }> = [];
    for (const { name, pattern } of XSS_PATTERNS) {
      if (pattern.test(html)) {
        found.push({ name });
      }
    }
    return found;
  }

  private checkMixedContent(html: string) {
    const httpResourcePattern = /(?:src|href|action)\s*=\s*["'](http:\/\/[^"']+)["']/gi;
    const matches: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = httpResourcePattern.exec(html)) !== null) {
      matches.push(m[1]);
    }
    return { count: matches.length, resources: matches.slice(0, 10) };
  }

  private listExternalScripts($: cheerio.CheerioAPI) {
    const domains: Set<string> = new Set();
    $('script[src]').each((_, el) => {
      const src = $(el).attr('src') || '';
      try {
        const d = new URL(src).hostname;
        domains.add(d);
      } catch { /* relative – skip */ }
    });
    return Array.from(domains);
  }
}
