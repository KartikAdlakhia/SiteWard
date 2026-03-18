import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { supabase, createWebsite, collapseDuplicateOpenIssues } from './db';
import { MonitorAgent } from './agents/MonitorAgent';
import { PerformanceAgent } from './agents/PerformanceAgent';
import { SecurityAgent } from './agents/SecurityAgent';
import { ContentAgent } from './agents/ContentAgent';
import { FixAgent } from './agents/FixAgent';

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ─────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));
app.use(express.json());

// Simple request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── Auth helper ─────────────────────────────────────────────────────────────
/**
 * Extracts the Bearer JWT from the Authorization header and verifies it
 * with Supabase. Returns the user or throws a 401.
 *
 * NOTE: supabase.auth.getUser() on the SERVER requires the client to pass
 * the user's JWT (obtained on the frontend after sign-in) in the
 * Authorization header. The anon client is used here just to verify the JWT.
 */
async function getAuthUser(req: Request): Promise<{ id: string; email?: string }> {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) throw new Error('No authorization token provided');

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Invalid or expired token');

  return data.user;
}

async function getOwnedWebsite(userId: string, websiteId: string) {
  const { data, error } = await supabase
    .from('websites')
    .select('id, url, user_id')
    .eq('id', websiteId)
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data;
}

async function getOwnedIssue(userId: string, issueId: string) {
  const { data: issue, error } = await supabase
    .from('issues')
    .select('*')
    .eq('id', issueId)
    .single();

  if (error || !issue) return null;

  const website = await getOwnedWebsite(userId, issue.website_id);
  if (!website) return null;

  return issue;
}

// Auth middleware factory — attach to protected routes
function requireAuth(req: Request, res: Response, next: NextFunction) {
  getAuthUser(req)
    .then((user) => {
      (req as any).user = user;
      next();
    })
    .catch((err) => {
      res.status(401).json({ error: err.message });
    });
}

// ── Health Check ───────────────────────────────────────────────────────────

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Websites ───────────────────────────────────────────────────────────────

// Add website
app.post('/api/websites', requireAuth, async (req: Request, res: Response) => {
  try {
    const { url, name, frequency = 'daily' } = req.body;
    const user = (req as any).user;

    if (!url || !name) {
      return res.status(400).json({ error: 'url and name are required' });
    }

    // Normalise URL
    const normalised = url.startsWith('http') ? url : `https://${url}`;

    const website = await createWebsite(user.id, normalised, name, frequency);

    // Fire-and-forget initial scan (don't block the HTTP response)
    triggerScans(website.id, normalised).catch(err =>
      console.error('[Scan] Initial scan failed for', website.id, err.message)
    );

    res.status(201).json(website);
  } catch (error: any) {
    console.error('Error adding website:', error);
    if (error.message?.includes('unique') || error.code === '23505') {
      return res.status(409).json({ error: 'This URL is already being monitored' });
    }
    res.status(500).json({ error: error.message });
  }
});

// List websites for the authenticated user
app.get('/api/websites', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const { data, error } = await supabase
      .from('websites')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    console.error('Error fetching websites:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single website
app.get('/api/websites/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const { data, error } = await supabase
      .from('websites')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', user.id) // enforce ownership
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Website not found' });

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete website
app.delete('/api/websites/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Verify ownership before deleting
    const { data: website, error: findErr } = await supabase
      .from('websites')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', user.id)
      .single();

    if (findErr || !website) {
      return res.status(404).json({ error: 'Website not found or not owned by you' });
    }

    const { error } = await supabase
      .from('websites')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true, id: req.params.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get scan results
app.get('/api/websites/:id/scans', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const websiteId = String(req.params.id);
    const website = await getOwnedWebsite(user.id, websiteId);

    if (!website) {
      return res.status(404).json({ error: 'Website not found or not owned by you' });
    }

    const { data, error } = await supabase
      .from('scan_results')
      .select('*')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get issues
app.get('/api/websites/:id/issues', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { status, severity } = req.query;
    const websiteId = String(req.params.id);
    const website = await getOwnedWebsite(user.id, websiteId);

    if (!website) {
      return res.status(404).json({ error: 'Website not found or not owned by you' });
    }

    let query = supabase
      .from('issues')
      .select('*')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', String(status));
    if (severity) query = query.eq('severity', String(severity));

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger manual scan
app.post('/api/websites/:id/scan', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const { data: website, error } = await supabase
      .from('websites')
      .select('url')
      .eq('id', req.params.id)
      .eq('user_id', user.id)
      .single();

    if (error || !website) return res.status(404).json({ error: 'Website not found' });

    // Respond immediately, run scan in background
    res.json({ message: 'Scan started', websiteId: req.params.id });

    triggerScans(String(req.params.id), website.url as string).catch(err =>
      console.error('[Scan] Manual scan failed for', req.params.id, err.message)
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Issues ─────────────────────────────────────────────────────────────────

// Update issue status
app.patch('/api/issues/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const issueId = String(req.params.id);
    const { status } = req.body;
    const allowed = ['open', 'in_progress', 'resolved', 'ignored'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }

    const issue = await getOwnedIssue(user.id, issueId);
    if (!issue) {
      return res.status(404).json({ error: 'Issue not found or not owned by you' });
    }

    const updatePayload: Record<string, any> = { status };
    if (status === 'resolved') updatePayload.resolved_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('issues')
      .update(updatePayload)
      .eq('id', issueId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get fix suggestion for an issue
app.get('/api/issues/:id/fix', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const issueId = String(req.params.id);
    const issue = await getOwnedIssue(user.id, issueId);

    if (!issue) return res.status(404).json({ error: 'Issue not found or not owned by you' });

    // If a fix suggestion already exists, return it
    if (issue.fix_suggestion && Object.keys(issue.fix_suggestion).length > 0) {
      return res.json({ issueId, fix: issue.fix_suggestion });
    }

    // Otherwise generate one now
    const fixAgent = new FixAgent(issue.website_id);
    const rollbackPlan = await fixAgent.createRollbackPlan(issue);

    res.json({
      issueId,
      rollbackPlan,
      message: 'Fix plan generated',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Apply fix (trigger FixAgent for a specific issue's website)
app.post('/api/issues/:id/fix', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const issueId = String(req.params.id);
    const issue = await getOwnedIssue(user.id, issueId);

    if (!issue) return res.status(404).json({ error: 'Issue not found or not owned by you' });

    const fixAgent = new FixAgent(issue.website_id);
    const rollbackPlan = await fixAgent.createRollbackPlan(issue);

    res.json({
      issueId,
      rollbackPlan,
      message: 'Fix process initiated — review the rollback plan before applying',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Core scan orchestration ────────────────────────────────────────────────

async function triggerScans(websiteId: string, websiteUrl: string) {
  console.log(`[Scan] Starting full scan for ${websiteUrl} (${websiteId})`);
  await collapseDuplicateOpenIssues(websiteId);

  const results: Record<string, any> = {};

  // Run all agents sequentially to avoid hammering the target site
  const monitorAgent = new MonitorAgent(websiteUrl, websiteId);
  results.monitor = await monitorAgent.scan();

  const performanceAgent = new PerformanceAgent(websiteUrl, websiteId);
  results.performance = await performanceAgent.scan();

  const securityAgent = new SecurityAgent(websiteUrl, websiteId);
  results.security = await securityAgent.scan();

  const contentAgent = new ContentAgent(websiteUrl, websiteId);
  results.content = await contentAgent.scan();

  // Compute a composite health score (0-100)
  const healthScore = computeHealthScore(results);

  // Determine overall status
  const hasCritical = anyHasStatus(results, 'error');
  const hasWarning = anyHasStatus(results, 'warning');
  const status = hasCritical ? 'critical' : hasWarning ? 'warning' : 'healthy';

  // Update website record
  await supabase
    .from('websites')
    .update({
      last_scan: new Date().toISOString(),
      health_score: healthScore,
      status,
    })
    .eq('id', websiteId);

  // Now generate fix suggestions for any newly created open issues
  const fixAgent = new FixAgent(websiteId);
  results.fixes = await fixAgent.processIssues();

  console.log(`[Scan] Completed — health: ${healthScore}, status: ${status}`);
  return results;
}

/**
 * Compute a 0-100 health score from agent results.
 * - Each agent contributes 25 points.
 * - 'success' = full points, 'warning' = half, 'error' = none.
 */
function computeHealthScore(results: Record<string, any>): number {
  const agents = ['monitor', 'performance', 'security', 'content'];
  let total = 0;
  for (const agent of agents) {
    const r = results[agent];
    if (!r) continue;
    if (r.status === 'success') total += 25;
    else if (r.status === 'warning') {
      // Deduct more for more issues
      const issueCount = Array.isArray(r.issues) ? r.issues.length : 0;
      total += Math.max(0, 25 - issueCount * 3);
    }
    // 'error' = 0 points
  }
  return Math.max(0, Math.min(100, total));
}

function anyHasStatus(results: Record<string, any>, status: string): boolean {
  return Object.values(results).some(r => r?.status === status);
}

// ── Scheduled scans ────────────────────────────────────────────────────────
/**
 * Every 5 minutes, find websites whose scan is overdue based on their
 * scan_frequency setting and trigger a scan for each.
 */
const FREQUENCY_MS: Record<string, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

async function runScheduledScans() {
  try {
    const { data: websites, error } = await supabase
      .from('websites')
      .select('id, url, scan_frequency, last_scan');

    if (error || !websites) return;

    const now = Date.now();
    for (const site of websites) {
      const freq = FREQUENCY_MS[site.scan_frequency] ?? FREQUENCY_MS.daily;
      const lastScan = site.last_scan ? new Date(site.last_scan).getTime() : 0;
      const isDue = now - lastScan >= freq;

      if (isDue) {
        console.log(`[Scheduler] Scan due for ${site.url}`);
        triggerScans(site.id, site.url).catch(err =>
          console.error('[Scheduler] Scan error for', site.url, err.message)
        );
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error:', (err as Error).message);
  }
}

// Run scheduler every 5 minutes
setInterval(runScheduledScans, 5 * 60 * 1000);
// Also run once a minute after boot to catch any immediately overdue scans
setTimeout(runScheduledScans, 60 * 1000);

// ── 404 / Error handlers ───────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Generic error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Unhandled error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Boot ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🛡️  SiteWard API Server`);
  console.log(`   ► Port   : ${PORT}`);
  console.log(`   ► API    : http://localhost:${PORT}/api`);
  console.log(`   ► Groq   : ${process.env.GROQ_API_KEY ? '✅ configured' : '⚠️  not set (rule-based fixes only)'}`);
  console.log(`   ► GitHub : ${process.env.GITHUB_TOKEN ? '✅ configured' : '⚠️  not set'}\n`);
});

export default app;
