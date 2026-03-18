import axios from 'axios';
import { Groq } from 'groq-sdk';
import { saveScanResult, createIssue, resolveStaleIssues } from '../db';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import type { Browser } from 'puppeteer';

export class ContentAgent {
  private websiteUrl: string;
  private websiteId: string;
  private groq: Groq;

  constructor(websiteUrl: string, websiteId: string) {
    this.websiteUrl = websiteUrl;
    this.websiteId = websiteId;
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  async scan() {
    try {
      console.log(`[ContentAgent] Analysing content for ${this.websiteUrl}`);

      const source = 'content_agent';
      const activeIssueFingerprints = new Set<string>();
      const issues: string[] = [];
      const data: Record<string, any> = {
        timestamp: new Date().toISOString(),
        url: this.websiteUrl,
      };

      let html = '';
      try {
        const res = await axios.get(this.websiteUrl, {
          timeout: 15000,
          headers: { 'User-Agent': 'SiteWard-Content/1.0' },
        });
        html = res.data;
      } catch (err: any) {
        data.error = err.message;
        issues.push('Could not fetch page for content analysis');
        await saveScanResult(this.websiteId, 'content', 'error', data, issues);
        return { status: 'error', issues, data };
      }

      const $ = cheerio.load(html);

      const meta = this.checkMetaTags($);
      data.meta = meta;

      if (!meta.hasTitle) {
        issues.push('Page is missing a <title> tag');
        const fp = 'seo:missing-title';
        activeIssueFingerprints.add(fp);
        await createIssue(
          this.websiteId,
          'seo',
          'high',
          'Missing Page Title',
          'A <title> tag is required for SEO and browser tab display.',
          meta,
          { source, fingerprint: fp }
        );
      } else if (meta.titleLength < 10 || meta.titleLength > 60) {
        issues.push(`Page title length (${meta.titleLength} chars) is outside optimal 10-60 char range`);
        const fp = 'seo:title-length-out-of-range';
        activeIssueFingerprints.add(fp);
        await createIssue(
          this.websiteId,
          'seo',
          'medium',
          'Page Title Length Out of Range',
          `Current title: "${meta.title}" (${meta.titleLength} chars). Keep between 10-60 characters for best results.`,
          meta,
          { source, fingerprint: fp }
        );
      }

      if (!meta.hasMetaDescription) {
        issues.push('Page is missing a meta description');
        const fp = 'seo:missing-meta-description';
        activeIssueFingerprints.add(fp);
        await createIssue(
          this.websiteId,
          'seo',
          'high',
          'Missing Meta Description',
          'Add a meta description (50-160 characters) to improve search engine click-through rates.',
          meta,
          { source, fingerprint: fp }
        );
      } else if ((meta.metaDescriptionLength || 0) < 50 || (meta.metaDescriptionLength || 0) > 160) {
        issues.push(`Meta description length (${meta.metaDescriptionLength} chars) is outside 50-160 range`);
      }

      if (!meta.hasOpenGraph) {
        issues.push('Missing Open Graph tags (og:title, og:description)');
        const fp = 'seo:missing-open-graph';
        activeIssueFingerprints.add(fp);
        await createIssue(
          this.websiteId,
          'seo',
          'low',
          'Missing Open Graph Tags',
          'Add og:title, og:description, og:image so the page previews well on social media.',
          meta,
          { source, fingerprint: fp }
        );
      }

      const headings = this.checkHeadingStructure($);
      const renderedH1Count = await this.getRenderedH1Count();
      data.headings = headings;
      data.renderedHeadings = { h1Count: renderedH1Count };

      if (headings.h1Count === 0) {
        if ((renderedH1Count ?? 0) === 0) {
          issues.push('Page has no H1 heading');
          const fp = 'seo:missing-h1';
          activeIssueFingerprints.add(fp);
          await createIssue(
            this.websiteId,
            'seo',
            'high',
            'Missing H1 Heading',
            'Every page should have exactly one H1 tag to signal the main topic to search engines.',
            { ...headings, renderedH1Count },
            { source, fingerprint: fp }
          );
        }
      } else if (headings.h1Count > 1) {
        issues.push(`Page has ${headings.h1Count} H1 headings (should have exactly 1)`);
        const fp = 'seo:multiple-h1';
        activeIssueFingerprints.add(fp);
        await createIssue(
          this.websiteId,
          'seo',
          'medium',
          'Multiple H1 Headings',
          `Found ${headings.h1Count} H1 tags. Use only one H1 per page.`,
          headings,
          { source, fingerprint: fp }
        );
      }

      const altText = this.checkAltText($);
      data.altText = altText;

      if (altText.missingCount > 0) {
        issues.push(`${altText.missingCount} image(s) missing alt text`);
        const fp = 'seo:missing-alt-text';
        activeIssueFingerprints.add(fp);
        await createIssue(
          this.websiteId,
          'seo',
          'medium',
          `${altText.missingCount} Image(s) Missing Alt Text`,
          'Images should have descriptive alt text for accessibility and SEO.',
          altText,
          { source, fingerprint: fp }
        );
      }

      const canonical = $('link[rel="canonical"]').attr('href');
      data.canonical = { present: !!canonical, url: canonical };
      if (!canonical) {
        issues.push('No canonical URL tag found');
        const fp = 'seo:missing-canonical';
        activeIssueFingerprints.add(fp);
        await createIssue(
          this.websiteId,
          'seo',
          'low',
          'Missing Canonical URL',
          'Add <link rel="canonical"> to tell search engines the preferred URL for this page.',
          { canonical },
          { source, fingerprint: fp }
        );
      }

      const hasStructuredData = $('script[type="application/ld+json"]').length > 0;
      data.structuredData = { present: hasStructuredData };
      if (!hasStructuredData) {
        issues.push('No structured data (JSON-LD) found');
      }

      const freshness = this.checkContentFreshness(html);
      data.freshness = freshness;
      if (freshness.hasOutdatedYearReferences) {
        issues.push('Possible outdated year references found (for example copyright year)');
      }

      const seoSuggestions = await this.generateSEOSuggestions(meta, headings, altText);
      data.seoSuggestions = seoSuggestions;

      await resolveStaleIssues(this.websiteId, source, Array.from(activeIssueFingerprints));

      await saveScanResult(
        this.websiteId,
        'content',
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
      console.error('[ContentAgent] Error:', error);
      return {
        status: 'error',
        issues: ['Failed to analyse content'],
        error: (error as Error).message,
      };
    }
  }

  private checkMetaTags($: cheerio.CheerioAPI) {
    const title = $('title').first().text().trim();
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogDesc = $('meta[property="og:description"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    const twitterCard = $('meta[name="twitter:card"]').attr('content');
    const viewport = $('meta[name="viewport"]').attr('content');
    const robots = $('meta[name="robots"]').attr('content');

    return {
      title,
      hasTitle: !!title,
      titleLength: title.length,
      metaDescription: metaDesc,
      hasMetaDescription: !!metaDesc,
      metaDescriptionLength: metaDesc.length,
      hasOpenGraph: !!(ogTitle && ogDesc),
      ogImage: !!ogImage,
      hasTwitterCard: !!twitterCard,
      hasViewport: !!viewport,
      robots: robots || 'not set',
    };
  }

  private checkHeadingStructure($: cheerio.CheerioAPI) {
    const headings: Record<string, string[]> = { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] };
    (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).forEach((tag) => {
      $(tag).each((_, el) => {
        headings[tag].push($(el).text().trim().slice(0, 100));
      });
    });

    return {
      h1Count: headings.h1.length,
      h1Texts: headings.h1,
      h2Count: headings.h2.length,
      h3Count: headings.h3.length,
    };
  }

  private checkAltText($: cheerio.CheerioAPI) {
    let total = 0;
    let missingCount = 0;
    const missingSrc: string[] = [];

    $('img').each((_, el) => {
      total++;
      const alt = $(el).attr('alt');
      if (alt === undefined || alt.trim() === '') {
        missingCount++;
        const src = $(el).attr('src') || 'unknown';
        missingSrc.push(src);
      }
    });

    return {
      total,
      missingCount,
      missingSrc: missingSrc.slice(0, 10),
      percentage: total > 0 ? ((missingCount / total) * 100).toFixed(1) : '0',
    };
  }

  private checkContentFreshness(html: string) {
    const currentYear = new Date().getFullYear();
    const twoYearsAgo = currentYear - 2;

    const copyrightPattern = new RegExp(`copyright.*${twoYearsAgo}(?![\\d])`, 'i');
    const hasOutdatedYearReferences = copyrightPattern.test(html);

    return { hasOutdatedYearReferences, currentYear };
  }

  private async getRenderedH1Count(): Promise<number | null> {
    let browser: Browser | null = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.goto(this.websiteUrl, { waitUntil: 'networkidle2', timeout: 20000 });
      return await page.$$eval('h1', (nodes: unknown[]) => nodes.length);
    } catch (error) {
      console.error('[ContentAgent] Rendered H1 check failed:', (error as Error).message);
      return null;
    } finally {
      if (browser) await browser.close();
    }
  }

  private async generateSEOSuggestions(
    meta: Record<string, any>,
    headings: Record<string, any>,
    altText: Record<string, any>
  ) {
    try {
      if (!process.env.GROQ_API_KEY) {
        return { improvements: [] };
      }

      const prompt = `You are an SEO expert. Analyse this page metadata and give 3 concise, prioritised improvement suggestions.

Data:
- Title: "${meta.title}" (${meta.titleLength} chars)
- Meta Description: "${meta.metaDescription}" (${meta.metaDescriptionLength} chars)
- H1 count: ${headings.h1Count}
- H1 text: ${JSON.stringify(headings.h1Texts)}
- Images without alt: ${altText.missingCount} / ${altText.total}
- Has Open Graph: ${meta.hasOpenGraph}
- Has canonical: ${meta.canonical?.present}

Return ONLY valid JSON: {"improvements": ["...", "...", "..."]}`;

      const response = await this.groq.chat.completions.create({
        model: 'llama3-8b-8192',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const text = response.choices[0]?.message?.content || '{}';
      return JSON.parse(text);
    } catch (error) {
      console.error('[ContentAgent] SEO suggestions error:', error);
      const fallback: string[] = [];
      if (!meta.hasOpenGraph) fallback.push('Add Open Graph meta tags (og:title, og:description, og:image) for social sharing');
      if (meta.titleLength > 60) fallback.push('Shorten your page title to under 60 characters for better search display');
      if (meta.metaDescriptionLength > 160) fallback.push('Shorten your meta description to under 160 characters');
      return { improvements: fallback };
    }
  }
}
