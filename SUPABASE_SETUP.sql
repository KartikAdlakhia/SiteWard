-- SiteWard Production Database Schema
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/YOUR-PROJECT/sql/new

-- Create websites table
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

-- Create scan_results table
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

-- Create issues table
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

-- Create indexes for better query performance
CREATE INDEX idx_scan_results_website_id ON scan_results(website_id);
CREATE INDEX idx_scan_results_created_at ON scan_results(created_at);
CREATE INDEX idx_issues_website_id ON issues(website_id);
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_websites_user_id ON websites(user_id);

-- Enable Row Level Security
ALTER TABLE websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for websites table
CREATE POLICY "Users can view their own websites"
  ON websites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create websites"
  ON websites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own websites"
  ON websites FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own websites"
  ON websites FOR DELETE
  USING (auth.uid() = user_id);

-- Create RLS policies for scan_results table
CREATE POLICY "Users can view scan results for their websites"
  ON scan_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM websites
      WHERE websites.id = scan_results.website_id
      AND websites.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert scan results"
  ON scan_results FOR INSERT
  WITH CHECK (true);

-- Create RLS policies for issues table
CREATE POLICY "Users can view issues for their websites"
  ON issues FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM websites
      WHERE websites.id = issues.website_id
      AND websites.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert issues"
  ON issues FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update issues"
  ON issues FOR UPDATE
  WITH CHECK (true);
