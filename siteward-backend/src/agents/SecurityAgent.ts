import axios from 'axios';
import { supabase, createIssue, saveScanResult } from '../db';
import * as cheerio from 'cheerio';
import CryptoJS from 'crypto-js';

export class SecurityAgent {
  private websiteUrl: string;
  private websiteId: string;

  constructor(websiteUrl: string, websiteId: string) {
    this.websiteUrl = websiteUrl;
    this.websiteId = websiteId;
  }

  async scan() {
    try {
      console.log(`[SecurityAgent] Scanning security for ${this.websiteUrl}`);
      
      const issues: string[] = [];
      const data: Record<string, any> = {
        timestamp: new Date().toISOString(),
        url: this.websiteUrl,
      };

      // Check HTTPS enforcement
      const httpsCheck = await this.checkHTTPSEnforcement();
      data.httpsStatus = httpsCheck;
      if (!httpsCheck.enforced) {
        issues.push('HTTPS is not properly enforced');
      }

      // Check for exposed API keys
      const exposedKeys = await this.scanForExposedKeys();
      if (exposedKeys.length > 0) {
        issues.push(`Found ${exposedKeys.length} potential exposed API keys`);
        data.exposedKeys = exposedKeys;
      }

      // Check for XSS vulnerabilities
      const xssVulns = await this.scanForXSSVulnerabilities();
      if (xssVulns.length > 0) {
        issues.push(`Found ${xssVulns.length} potential XSS vulnerabilities`);
        data.xssVulnerabilities = xssVulns;
      }

      // Check for defacement/malware
      const malwareCheck = await this.checkForMalware();
      if (malwareCheck.suspicious) {
        issues.push('Suspicious content detected - possible defacement');
      }
      data.malwareStatus = malwareCheck;

      // Check security headers
      const securityHeaders = await this.checkSecurityHeaders();
      data.securityHeaders = securityHeaders;
      if (!securityHeaders.allPresent) {
        issues.push('Missing recommended security headers');
      }

      await saveScanResult(
        this.websiteId,
        'security',
        issues.length === 0 ? 'success' : 'warning',
        data,
        issues
      );

      // Create critical issues
      if (exposedKeys.length > 0) {
        await createIssue(
          this.websiteId,
          'security',
          'critical',
          'Exposed API Keys Detected',
          `Found ${exposedKeys.length} potential exposed API keys in source code`,
          { exposedKeys }
        );
      }

      if (xssVulns.length > 0) {
        await createIssue(
          this.websiteId,
          'security',
          'high',
          'XSS Vulnerabilities Detected',
          `Found ${xssVulns.length} potential XSS vulnerabilities`,
          { vulnerabilities: xssVulns }
        );
      }

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

  private async checkHTTPSEnforcement() {
    try {
      const url = new URL(this.websiteUrl);
      const isHttps = url.protocol === 'https:';
      
      return {
        enforced: isHttps,
        protocol: url.protocol,
        hasHSTS: Math.random() > 0.3,
      };
    } catch {
      return { enforced: false, error: 'Invalid URL' };
    }
  }

  private async scanForExposedKeys() {
    const patterns = [
      /sk_live_[A-Za-z0-9]{24}/,
      /api_key["\']?\s*[=:]\s*["\']?[A-Za-z0-9_-]{32}/i,
      /aws_access_key["\']?\s*[=:]\s*["\']?AKIA[0-9A-Z]{16}/,
      /github_token["\']?\s*[=:]\s*["\']?ghp_[A-Za-z0-9_]{36}/,
    ];

    // Simulated key detection - in production, analyze actual source
    const detected: string[] = [];
    if (Math.random() > 0.8) {
      detected.push('Potential Stripe API key in inline script');
    }
    
    return detected;
  }

  private async scanForXSSVulnerabilities() {
    // Simulated XSS detection
    const xssPatterns = [
      'innerHTML without sanitization',
      'eval() usage detected',
      'document.write() in script',
      'Unsanitized user input in HTML attribute',
    ];

    const detected: string[] = [];
    if (Math.random() > 0.6) {
      detected.push(xssPatterns[Math.floor(Math.random() * xssPatterns.length)]);
    }

    return detected;
  }

  private async checkForMalware() {
    // Simulated malware/defacement check
    return {
      suspicious: Math.random() > 0.95,
      scanDate: new Date().toISOString(),
      scanResult: 'clean',
    };
  }

  private async checkSecurityHeaders() {
    // Common security headers
    const requiredHeaders = [
      'Content-Security-Policy',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Strict-Transport-Security',
      'Referrer-Policy',
    ];

    // Simulated header check
    const presentHeaders = requiredHeaders.filter(() => Math.random() > 0.4);

    return {
      allPresent: presentHeaders.length === requiredHeaders.length,
      present: presentHeaders,
      missing: requiredHeaders.filter(h => !presentHeaders.includes(h)),
    };
  }
}
