import { Groq } from 'groq-sdk';
import { supabase } from '../db';

interface Issue {
  id: string;
  title: string;
  type: string;
  severity: string;
  description: string;
  fix_suggestion?: Record<string, any>;
}

/**
 * FixAgent — uses Groq AI to generate actionable fix suggestions for open issues.
 * It does NOT auto-apply code (that requires GitHub access and is opt-in).
 * Instead it enriches every issue with a detailed fix plan saved to Supabase.
 */
export class FixAgent {
  private websiteId: string;
  private groq: Groq | null;
  private githubToken: string;

  constructor(websiteId: string) {
    this.websiteId = websiteId;
    this.githubToken = process.env.GITHUB_TOKEN || '';
    // Only initialise Groq if key is present
    this.groq = process.env.GROQ_API_KEY
      ? new Groq({ apiKey: process.env.GROQ_API_KEY })
      : null;
  }

  /**
   * Fetch all open issues for the website and enrich each with an AI-generated
   * fix suggestion stored back in Supabase's fix_suggestion JSONB field.
   */
  async processIssues() {
    try {
      console.log(`[FixAgent] Processing issues for website ${this.websiteId}`);

      const { data: issues, error } = await supabase
        .from('issues')
        .select('*')
        .eq('website_id', this.websiteId)
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!issues || issues.length === 0) {
        console.log('[FixAgent] No open issues to process');
        return { status: 'success', processedIssues: 0, results: [] };
      }

      const results: any[] = [];

      for (const issue of issues) {
        // Skip if we already have a fix suggestion stored
        if (issue.fix_suggestion && Object.keys(issue.fix_suggestion).length > 0) {
          results.push({ issueId: issue.id, skipped: true, reason: 'fix already present' });
          continue;
        }

        const fix = await this.generateFix(issue);

        // Persist the fix suggestion into Supabase
        const { error: updateError } = await supabase
          .from('issues')
          .update({ fix_suggestion: fix })
          .eq('id', issue.id);

        if (updateError) {
          console.error(`[FixAgent] Could not update issue ${issue.id}:`, updateError.message);
        }

        results.push({
          issueId: issue.id,
          issueTitle: issue.title,
          fixGenerated: true,
          canAutoFix: fix.canAutoFix,
          fixType: fix.fixType,
        });
      }

      console.log(`[FixAgent] Processed ${results.length} issue(s)`);
      return { status: 'success', processedIssues: results.length, results };
    } catch (error) {
      console.error('[FixAgent] Error:', error);
      return { status: 'error', error: (error as Error).message };
    }
  }

  /**
   * Generate a fix suggestion for a single issue.
   * Uses Groq when available, falls back to rule-based defaults.
   */
  private async generateFix(issue: Issue): Promise<Record<string, any>> {
    if (this.groq) {
      try {
        const prompt = `You are a website maintenance expert. Generate a concise, actionable fix for this issue.

Issue Type: ${issue.type}
Severity: ${issue.severity}
Title: ${issue.title}
Description: ${issue.description}

Return ONLY valid JSON in this exact shape:
{
  "canAutoFix": false,
  "fixType": "meta_tag|image_optimization|alt_text|broken_link|security_header|code_cleanup|manual_review",
  "priority": "immediate|soon|later",
  "summary": "One-sentence fix description",
  "steps": ["Step 1", "Step 2", "Step 3"],
  "codeExample": "optional short code snippet or empty string",
  "estimatedEffort": "5 minutes|30 minutes|1 hour|1 day"
}`;

        const response = await this.groq.chat.completions.create({
          model: 'llama3-8b-8192',
          max_tokens: 512,
          temperature: 0.2,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        });

        const text = response.choices[0]?.message?.content || '{}';
        const parsed = JSON.parse(text);

        // Ensure required fields
        return {
          canAutoFix: parsed.canAutoFix ?? false,
          fixType: parsed.fixType ?? 'manual_review',
          priority: parsed.priority ?? 'soon',
          summary: parsed.summary ?? '',
          steps: Array.isArray(parsed.steps) ? parsed.steps : [],
          codeExample: parsed.codeExample ?? '',
          estimatedEffort: parsed.estimatedEffort ?? 'unknown',
          generatedBy: 'groq-llama3',
          generatedAt: new Date().toISOString(),
        };
      } catch (err) {
        console.error(`[FixAgent] Groq error for issue ${issue.id}:`, (err as Error).message);
      }
    }

    // Rule-based fallback
    return this.getDefaultFix(issue.type, issue.severity);
  }

  /**
   * Rule-based fallback fixes — no AI required.
   */
  private getDefaultFix(issueType: string, severity: string): Record<string, any> {
    const fixes: Record<string, Record<string, any>> = {
      broken_link: {
        canAutoFix: false,
        fixType: 'broken_link',
        priority: 'soon',
        summary: 'Update or remove the broken link',
        steps: [
          'Open your CMS or codebase and search for the broken URL',
          'Either update it to the correct destination or remove the link',
          'Re-run a scan to verify the fix',
        ],
        codeExample: '',
        estimatedEffort: '15 minutes',
      },
      performance: {
        canAutoFix: false,
        fixType: 'image_optimization',
        priority: 'soon',
        summary: 'Optimise images and enable compression',
        steps: [
          'Convert images to WebP format using tools like Squoosh or ImageMagick',
          'Add loading="lazy" attribute to all below-the-fold images',
          'Enable gzip or Brotli compression on your server / CDN',
          'Verify with the Page Speed Insights tool',
        ],
        codeExample: '<img src="hero.webp" loading="lazy" alt="Hero image">',
        estimatedEffort: '1 hour',
      },
      security: {
        canAutoFix: false,
        fixType: severity === 'critical' ? 'manual_review' : 'security_header',
        priority: severity === 'critical' ? 'immediate' : 'soon',
        summary: 'Apply recommended security configuration',
        steps: [
          'Identify the specific security finding from the issue description',
          'If it is a missing header: add it in your server config (Nginx/Apache/.htaccess) or CDN',
          'If it is an exposed secret: remove it from the codebase immediately and rotate the credential',
          'Re-scan to verify the fix',
        ],
        codeExample: '# Nginx example\nadd_header X-Content-Type-Options "nosniff";\nadd_header X-Frame-Options "SAMEORIGIN";\nadd_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;',
        estimatedEffort: '30 minutes',
      },
      seo: {
        canAutoFix: false,
        fixType: 'meta_tag',
        priority: 'soon',
        summary: 'Add or improve meta tags for SEO',
        steps: [
          'Open your page\'s HTML <head> section',
          'Add a descriptive <title> tag (10–60 characters)',
          'Add a meta description (50–160 characters)',
          'Add Open Graph tags for social sharing',
        ],
        codeExample: '<title>Your Page Title — Brand Name</title>\n<meta name="description" content="Concise page description here.">\n<meta property="og:title" content="Your Page Title">\n<meta property="og:description" content="Concise page description.">',
        estimatedEffort: '15 minutes',
      },
      monitor: {
        canAutoFix: false,
        fixType: 'manual_review',
        priority: 'immediate',
        summary: 'Investigate and restore site availability',
        steps: [
          'Check your hosting provider\'s status page',
          'Review server error logs',
          'Verify DNS configuration is correct',
          'Contact your hosting provider if the issue persists',
        ],
        codeExample: '',
        estimatedEffort: '1 hour',
      },
    };

    const fix = fixes[issueType] || {
      canAutoFix: false,
      fixType: 'manual_review',
      priority: 'soon',
      summary: 'Manual review required',
      steps: ['Investigate the issue description and apply the appropriate fix'],
      codeExample: '',
      estimatedEffort: 'unknown',
    };

    return { ...fix, generatedBy: 'rule-based', generatedAt: new Date().toISOString() };
  }

  /**
   * Generate a rollback plan for a specific issue (used by the API route).
   */
  async createRollbackPlan(issue: Issue): Promise<Record<string, any>> {
    if (this.groq) {
      try {
        const prompt = `Create a step-by-step rollback plan for reverting this website fix:

Issue type: ${issue.type}
Issue title: ${issue.title}

Return ONLY valid JSON:
{
  "steps": ["step1", "step2"],
  "estimatedTime": "5 minutes",
  "risk": "low|medium|high",
  "backupRequired": true
}`;

        const response = await this.groq.chat.completions.create({
          model: 'llama3-8b-8192',
          max_tokens: 256,
          temperature: 0.2,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        });

        const text = response.choices[0]?.message?.content || '{}';
        return JSON.parse(text);
      } catch (err) {
        console.error('[FixAgent] Rollback plan error:', err);
      }
    }

    return {
      steps: [
        'Restore from the most recent backup of the site',
        'Verify the site is accessible and functioning correctly',
        'Re-run a SiteWard scan to confirm the rollback was successful',
      ],
      estimatedTime: '10 minutes',
      risk: 'low',
      backupRequired: true,
    };
  }
}
