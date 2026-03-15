import axios from 'axios';
import { Groq } from 'groq-sdk';
import { supabase, createIssue, saveScanResult } from '../db';
import * as cheerio from 'cheerio';

export class ContentAgent {
  private websiteUrl: string;
  private websiteId: string;
  private groq: Groq;

  constructor(websiteUrl: string, websiteId: string) {
    this.websiteUrl = websiteUrl;
    this.websiteId = websiteId;
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  async scan() {
    try {
      console.log(`[ContentAgent] Analyzing content for ${this.websiteUrl}`);
      
      const issues: string[] = [];
      const data: Record<string, any> = {
        timestamp: new Date().toISOString(),
        url: this.websiteUrl,
      };

      // Get page content
      const response = await axios.get(this.websiteUrl, { timeout: 10000 });
      const html = response.data;
      const $ = cheerio.load(html);

      // Check for outdated content
      const contentFreshness = await this.checkContentFreshness($, html);
      data.contentFreshness = contentFreshness;
      if (contentFreshness.hasOutdatedContent) {
        issues.push('Outdated content detected (2024 references found)');
      }

      // Check meta tags
      const metaTags = await this.checkMetaTags($);
      data.metaTags = metaTags;
      if (!metaTags.hasMetaDescription || !metaTags.hasMetaKeywords) {
        issues.push('Missing or incomplete meta tags');
      }

      // Check for missing alt text
      const altTextIssues = await this.checkAltText($);
      if (altTextIssues.imagesWithoutAlt > 0) {
        issues.push(`${altTextIssues.imagesWithoutAlt} images missing alt text`);
        data.altTextIssues = altTextIssues;
      }

      // Generate SEO suggestions using Groq
      const seoSuggestions = await this.generateSEOSuggestions($, html);
      data.seoSuggestions = seoSuggestions;
      if (seoSuggestions.improvements && seoSuggestions.improvements.length > 0) {
        issues.push(`SEO improvements available: ${seoSuggestions.improvements.length} items`);
      }

      await saveScanResult(
        this.websiteId,
        'content',
        issues.length === 0 ? 'success' : 'warning',
        data,
        issues
      );

      // Create issues for critical items
      if (altTextIssues.imagesWithoutAlt > 0) {
        await createIssue(
          this.websiteId,
          'seo',
          'medium',
          `${altTextIssues.imagesWithoutAlt} Images Missing Alt Text`,
          'Images should have descriptive alt text for accessibility and SEO',
          { count: altTextIssues.imagesWithoutAlt }
        );
      }

      return {
        status: issues.length === 0 ? 'success' : 'warning',
        issues,
        data,
      };
    } catch (error) {
      console.error('[ContentAgent] Error:', error);
      return {
        status: 'error',
        issues: ['Failed to analyze content'],
        error: (error as Error).message,
      };
    }
  }

  private async checkContentFreshness($: cheerio.CheerioAPI, html: string) {
    const outdatedPatterns = [
      /202[0-4](?![\d])/g,
      /copyright.*202[0-4]/gi,
      /updated.*202[0-4]/gi,
    ];

    let hasOutdatedContent = false;
    for (const pattern of outdatedPatterns) {
      if (pattern.test(html)) {
        hasOutdatedContent = true;
        break;
      }
    }

    return {
      hasOutdatedContent,
      lastUpdatedTag: $('meta[name="last-modified"]').attr('content'),
      foundDates: Array.from(html.match(/20\d{2}/g) || []).slice(0, 5),
    };
  }

  private async checkMetaTags($: cheerio.CheerioAPI) {
    return {
      hasMetaDescription: !!$('meta[name="description"]').attr('content'),
      metaDescription: $('meta[name="description"]').attr('content'),
      hasMetaKeywords: !!$('meta[name="keywords"]').attr('content'),
      metaKeywords: $('meta[name="keywords"]').attr('content'),
      hasOpenGraph: !!$('meta[property="og:title"]').attr('content'),
      hasTwitterCard: !!$('meta[name="twitter:card"]').attr('content'),
    };
  }

  private async checkAltText($: cheerio.CheerioAPI) {
    let totalImages = 0;
    let imagesWithoutAlt = 0;

    $('img').each((_, element) => {
      totalImages++;
      if (!$(element).attr('alt') || $(element).attr('alt')?.trim() === '') {
        imagesWithoutAlt++;
      }
    });

    return {
      totalImages,
      imagesWithoutAlt,
      percentage: totalImages > 0 ? ((imagesWithoutAlt / totalImages) * 100).toFixed(1) : 0,
    };
  }

  private async generateSEOSuggestions($: cheerio.CheerioAPI, html: string) {
    try {
      const title = $('title').text();
      const h1Count = $('h1').length;
      const metaDesc = $('meta[name="description"]').attr('content');

      const prompt = `
        Analyze this webpage content and provide 3-5 SEO improvement suggestions:
        - Title: ${title}
        - Has meta description: ${!!metaDesc}
        - Number of H1 tags: ${h1Count}
        - URL structure: ${this.websiteUrl}
        
        Provide concise, actionable suggestions in JSON format: {"improvements": ["suggestion1", "suggestion2"]}
      `;

      const message = await this.groq.messages.create({
        model: 'mixtral-8x7b-32768',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = message.content[0];
      if (content.type === 'text') {
        const parsed = JSON.parse(content.text);
        return parsed;
      }

      return { improvements: [] };
    } catch (error) {
      console.error('SEO suggestion generation error:', error);
      return {
        improvements: [
          'Add more H1 tags for better heading structure',
          'Improve meta description length (50-160 characters)',
          'Add internal links to related pages',
        ],
      };
    }
  }
}
