import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { supabase, createWebsite, Website } from './db';
import { MonitorAgent } from './agents/MonitorAgent';
import { PerformanceAgent } from './agents/PerformanceAgent';
import { SecurityAgent } from './agents/SecurityAgent';
import { ContentAgent } from './agents/ContentAgent';
import { FixAgent } from './agents/FixAgent';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Add website
app.post('/api/websites', async (req: Request, res: Response) => {
  try {
    const { url, name, frequency = 'hourly' } = req.body;
    const user = await supabase.auth.getUser();

    if (!user.data.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const website = await createWebsite(user.data.user.id, url, name, frequency);
    
    // Start initial scan
    await triggerScans(website.id, url);

    res.json(website);
  } catch (error) {
    console.error('Error adding website:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get websites
app.get('/api/websites', async (req: Request, res: Response) => {
  try {
    const user = await supabase.auth.getUser();

    if (!user.data.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { data, error } = await supabase
      .from('websites')
      .select('*')
      .eq('user_id', user.data.user.id);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching websites:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get website details
app.get('/api/websites/:id', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('websites')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get scan results
app.get('/api/websites/:id/scans', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('scan_results')
      .select('*')
      .eq('website_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get issues
app.get('/api/websites/:id/issues', async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .eq('website_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Trigger manual scan
app.post('/api/websites/:id/scan', async (req: Request, res: Response) => {
  try {
    const { data: website, error } = await supabase
      .from('websites')
      .select('url')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    const results = await triggerScans(req.params.id as string, website.url as string);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Update issue status
app.patch('/api/issues/:id', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const { data, error } = await supabase
      .from('issues')
      .update({ status })
      .eq('id', req.params.id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Apply fix
app.post('/api/issues/:id/fix', async (req: Request, res: Response) => {
  try {
    const { data: issue, error: issueError } = await supabase
      .from('issues')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (issueError) throw issueError;

    const fixAgent = new FixAgent(issue.website_id);
    const rollbackPlan = await fixAgent.createRollbackPlan(issue);

    res.json({
      issueId: req.params.id,
      rollbackPlan,
      message: 'Fix process initiated',
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Trigger all scans for a website
async function triggerScans(websiteId: string, websiteUrl: string) {
  try {
    const results: any = {};

    // MonitorAgent
    const monitorAgent = new MonitorAgent(websiteUrl, websiteId);
    results.monitor = await monitorAgent.scan();

    // PerformanceAgent
    const performanceAgent = new PerformanceAgent(websiteUrl, websiteId);
    results.performance = await performanceAgent.scan();

    // SecurityAgent
    const securityAgent = new SecurityAgent(websiteUrl, websiteId);
    results.security = await securityAgent.scan();

    // ContentAgent
    const contentAgent = new ContentAgent(websiteUrl, websiteId);
    results.content = await contentAgent.scan();

    // FixAgent
    const fixAgent = new FixAgent(websiteId);
    results.fixes = await fixAgent.processIssues();

    // Update website last_scan time
    await supabase
      .from('websites')
      .update({ last_scan: new Date().toISOString() })
      .eq('id', websiteId);

    return results;
  } catch (error) {
    console.error('Error triggering scans:', error);
    throw error;
  }
}

app.listen(PORT, () => {
  console.log(`🚀 SiteWard API Server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:3000`);
  console.log(`🔌 API: http://localhost:${PORT}/api`);
});
