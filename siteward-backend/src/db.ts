import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Website {
  id: string;
  user_id: string;
  url: string;
  name: string;
  health_score: number;
  status: 'healthy' | 'warning' | 'critical';
  last_scan: string;
  created_at: string;
}

export interface ScanResult {
  id: string;
  website_id: string;
  scan_type: 'monitor' | 'performance' | 'security' | 'content';
  status: 'success' | 'warning' | 'error';
  data: Record<string, any>;
  issues: string[];
  created_at: string;
}

export interface Issue {
  id: string;
  website_id: string;
  type: 'broken_link' | 'performance' | 'security' | 'seo' | 'visual';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
}

export interface IssueTrackingMeta {
  source?: string;
  fingerprint?: string;
}

export async function initializeDatabase() {
  try {
    // Websites table
    await supabase.rpc('execute_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS websites (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES auth.users(id),
          url TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          health_score INTEGER DEFAULT 100,
          status TEXT DEFAULT 'healthy',
          last_scan TIMESTAMP,
          scan_frequency TEXT DEFAULT 'hourly',
          notification_preferences JSONB DEFAULT '{"email": true, "dashboard": true}',
          created_at TIMESTAMP DEFAULT now()
        );
      `
    });

    // Scan results table
    await supabase.rpc('execute_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS scan_results (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
          scan_type TEXT NOT NULL,
          status TEXT NOT NULL,
          data JSONB,
          issues TEXT[] DEFAULT '{}',
          metrics JSONB,
          created_at TIMESTAMP DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_scan_results_website_id ON scan_results(website_id);
        CREATE INDEX IF NOT EXISTS idx_scan_results_created_at ON scan_results(created_at);
      `
    });

    // Issues table
    await supabase.rpc('execute_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS issues (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          severity TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'open',
          fix_suggestion JSONB,
          github_pr_url TEXT,
          created_at TIMESTAMP DEFAULT now(),
          resolved_at TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_issues_website_id ON issues(website_id);
        CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
      `
    });

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

export async function createWebsite(
  userId: string,
  url: string,
  name: string,
  frequency: string = 'hourly'
) {
  const { data, error } = await supabase
    .from('websites')
    .insert([
      {
        user_id: userId,
        url,
        name,
        scan_frequency: frequency,
        health_score: 100,
        status: 'healthy',
      },
    ])
    .select();

  if (error) throw error;
  return data[0];
}

export async function saveScanResult(
  websiteId: string,
  scanType: string,
  status: string,
  data: Record<string, any>,
  issues: string[],
  metrics?: Record<string, any>
) {
  const { data: result, error } = await supabase
    .from('scan_results')
    .insert([
      {
        website_id: websiteId,
        scan_type: scanType,
        status,
        data,
        issues,
        metrics,
      },
    ])
    .select();

  if (error) throw error;
  return result[0];
}

export async function createIssue(
  websiteId: string,
  type: string,
  severity: string,
  title: string,
  description: string,
  fixSuggestion?: Record<string, any>,
  tracking?: IssueTrackingMeta
) {
  const fingerprint = tracking?.fingerprint || `${type}:${title}`.toLowerCase();
  const source = tracking?.source || 'unknown';
  const now = new Date().toISOString();

  const payload = {
    ...(fixSuggestion || {}),
    _source: source,
    _fingerprint: fingerprint,
    _last_seen: now,
  };

  // Dedupe by unresolved issue fingerprint for this website
  const { data: existing, error: existingErr } = await supabase
    .from('issues')
    .select('id,status,fix_suggestion,created_at')
    .eq('website_id', websiteId)
    .eq('type', type)
    .in('status', ['open', 'in_progress'])
    .contains('fix_suggestion', { _fingerprint: fingerprint })
    .order('created_at', { ascending: false });

  if (existingErr) throw existingErr;

  // Backward-compatible fallback for older issues that were created without tracking metadata
  let matchedExisting = existing;
  if (!matchedExisting || matchedExisting.length === 0) {
    const { data: legacyExisting, error: legacyErr } = await supabase
      .from('issues')
      .select('id,status,fix_suggestion,created_at')
      .eq('website_id', websiteId)
      .eq('type', type)
      .eq('title', title)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false });

    if (legacyErr) throw legacyErr;
    matchedExisting = legacyExisting || [];
  }

  if (matchedExisting && matchedExisting.length > 0) {
    const newest = matchedExisting[0];

    // Resolve any extra duplicates that were already open
    if (matchedExisting.length > 1) {
      const duplicateIds = matchedExisting.slice(1).map((i: any) => i.id);
      if (duplicateIds.length > 0) {
        const { error: dedupeErr } = await supabase
          .from('issues')
          .update({ status: 'resolved', resolved_at: now })
          .in('id', duplicateIds);
        if (dedupeErr) throw dedupeErr;
      }
    }

    const { data: updated, error: updateErr } = await supabase
      .from('issues')
      .update({
        severity,
        title,
        description,
        fix_suggestion: payload,
        status: newest.status === 'in_progress' ? 'in_progress' : 'open',
        resolved_at: null,
      })
      .eq('id', newest.id)
      .select();

    if (updateErr) throw updateErr;
    return updated[0];
  }

  const { data, error } = await supabase
    .from('issues')
    .insert([
      {
        website_id: websiteId,
        type,
        severity,
        title,
        description,
        fix_suggestion: payload,
        status: 'open',
      },
    ])
    .select();

  if (error) throw error;
  return data[0];
}

export async function resolveStaleIssues(
  websiteId: string,
  source: string,
  activeFingerprints: string[]
) {
  const { data: trackedIssues, error } = await supabase
    .from('issues')
    .select('id,fix_suggestion,status')
    .eq('website_id', websiteId)
    .in('status', ['open', 'in_progress'])
    .contains('fix_suggestion', { _source: source });

  if (error) throw error;
  if (!trackedIssues || trackedIssues.length === 0) return { resolved: 0 };

  const activeSet = new Set(activeFingerprints);
  const staleIds = trackedIssues
    .filter((issue: any) => {
      const fp = issue?.fix_suggestion?._fingerprint;
      return typeof fp === 'string' && !activeSet.has(fp);
    })
    .map((issue: any) => issue.id);

  if (staleIds.length === 0) return { resolved: 0 };

  const { error: updateErr } = await supabase
    .from('issues')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    })
    .in('id', staleIds);

  if (updateErr) throw updateErr;
  return { resolved: staleIds.length };
}

export async function collapseDuplicateOpenIssues(websiteId: string) {
  const { data: issues, error } = await supabase
    .from('issues')
    .select('id,type,title,status,created_at')
    .eq('website_id', websiteId)
    .in('status', ['open', 'in_progress'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!issues || issues.length === 0) return { resolved: 0 };

  const seen = new Set<string>();
  const duplicateIds: string[] = [];

  for (const issue of issues as any[]) {
    const key = `${issue.type}::${issue.title}`.toLowerCase();
    if (seen.has(key)) {
      duplicateIds.push(issue.id);
    } else {
      seen.add(key);
    }
  }

  if (duplicateIds.length === 0) return { resolved: 0 };

  const { error: updateErr } = await supabase
    .from('issues')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    })
    .in('id', duplicateIds);

  if (updateErr) throw updateErr;
  return { resolved: duplicateIds.length };
}
