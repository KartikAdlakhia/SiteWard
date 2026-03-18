# SiteWard Deployment Guide

This guide walks you through deploying SiteWard to production using Vercel and Supabase.

## 📋 Prerequisites

- Vercel account (free): https://vercel.com
- Supabase project (free): https://supabase.com
- GitHub repository with your SiteWard code
- Groq API key: https://console.groq.com
- GitHub personal token (optional): https://github.com/settings/tokens

## 🚀 Step 1: Prepare Supabase for Production

### 1.1 Create Production Database

1. Go to https://supabase.com and create a new project
2. Name: `siteward-prod`
3. Region: Choose closest to your users
4. Wait for the project to be created

### 1.2 Set Up Database Schema

In Supabase SQL Editor, run:

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "http";

-- Websites table
CREATE TABLE websites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  health_score INTEGER DEFAULT 100,
  status TEXT DEFAULT 'healthy' CHECK (status IN ('healthy', 'warning', 'critical')),
  last_scan TIMESTAMP DEFAULT now(),
  scan_frequency TEXT DEFAULT 'hourly' CHECK (scan_frequency IN ('hourly', 'daily', 'weekly')),
  notification_preferences JSONB DEFAULT '{"email": true, "dashboard": true}',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id, url)
);

-- Scan results table
CREATE TABLE scan_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('monitor', 'performance', 'security', 'content')),
  status TEXT NOT NULL CHECK (status IN ('success', 'warning', 'error')),
  data JSONB,
  issues TEXT[] DEFAULT '{}',
  metrics JSONB,
  created_at TIMESTAMP DEFAULT now()
);

-- Issues table
CREATE TABLE issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('broken_link', 'performance', 'security', 'seo', 'visual')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  fix_suggestion JSONB,
  github_pr_url TEXT,
  created_at TIMESTAMP DEFAULT now(),
  resolved_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_websites_user_id ON websites(user_id);
CREATE INDEX idx_scan_results_website_id ON scan_results(website_id);
CREATE INDEX idx_scan_results_created_at ON scan_results(created_at);
CREATE INDEX idx_issues_website_id ON issues(website_id);
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_severity ON issues(severity);

-- Enable Row Level Security
ALTER TABLE websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only see their own websites"
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

CREATE POLICY "Users can see scan results for their websites"
  ON scan_results FOR SELECT
  USING (website_id IN (SELECT id FROM websites WHERE user_id = auth.uid()));

CREATE POLICY "Users can see issues for their websites"
  ON issues FOR SELECT
  USING (website_id IN (SELECT id FROM websites WHERE user_id = auth.uid()));
```

### 1.3 Get API Keys

1. Go to Supabase dashboard → Settings → API
2. Copy:
   - `Project URL` (SUPABASE_URL)
   - `anon` key (SUPABASE_ANON_KEY)
   - `service_role` key (for backend operations)

## 🌐 Step 2: Deploy Frontend to Vercel

### 2.1 Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: SiteWard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/siteward.git
git push -u origin main
```

### 2.2 Deploy Frontend

1. Go to https://vercel.com and sign in
2. Click "New Project"
3. Select your `siteward` GitHub repository
4. Configure project:
   - Preferred:
     - **Framework**: Vite
     - **Root Directory**: `siteward-frontend`
     - **Build Command**: `npm run build`
     - **Output Directory**: `dist`
   - Alternative:
     - Import the repo root directly and let the top-level [vercel.json](C:\AI Agents\Antigravity workspace\Siteward\vercel.json) handle install/build for `siteward-frontend`

5. Add environment variables:
   ```
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_API_URL=https://your-api-domain.com/api
   ```

6. Click "Deploy"
7. Wait for deployment to complete
8. Your frontend is now live at `your-project.vercel.app`

## 🔌 Step 3: Deploy Backend (API Server)

### Option A: Deploy to Vercel

1. Create a `/api` folder in `siteward-backend`
2. Convert Express routes to Vercel Functions
3. Create `vercel.json` configuration:

```json
{
  "buildCommand": "npm run build --prefix siteward-backend",
  "outputDirectory": "siteward-backend/dist"
}
```

This repo has not been converted to Vercel Functions yet, so deploying the
current `siteward-backend` directly to Vercel will usually fail or behave
poorly. The current backend uses Express plus Puppeteer/Lighthouse workloads,
which are a better fit for Railway or Render.

### Option B: Use Railway.app (Recommended for current backend)

1. Go to https://railway.app
2. Create new project
3. Connect GitHub repository
4. Select `siteward-backend` directory
5. Add environment variables
6. Deploy

### Option C: Use Render.com (Another Free Option)

1. Go to https://render.com
2. Create Web Service
3. Connect GitHub
4. Configure build:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
5. Add environment variables
6. Deploy

## 🔧 Step 4: Configure Environment Variables

Update both frontend and backend environment variables with production values:

**Backend (Vercel/Railway/Render):**
```
PORT=5000
NODE_ENV=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
GROQ_API_KEY=your-groq-api-key
GITHUB_TOKEN=your-github-token
```

**Frontend (Vercel):**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=https://your-api-domain.com/api
```

## 📊 Step 5: Set Up Monitoring (Optional)

1. **Supabase Logs**: Check Supabase dashboard for database logs
2. **Vercel Analytics**: Enable in Vercel project settings
3. **Groq Dashboard**: Monitor API usage at https://console.groq.com

## 🔐 Step 6: Security Configuration

### Enable CORS for Production

In `siteward-backend/src/index.ts`:

```typescript
app.use(cors({
  origin: [
    'https://your-app.vercel.app',
    'https://www.your-domain.com',
  ],
  credentials: true,
}));
```

### Set Up HTTPS

- Vercel: Automatic (included)
- Railway/Render: Automatic (included)
- Custom domain: Use Vercel domains feature

## 🚨 Step 7: Set Up Alerts

### Database Alerts
1. Go to Supabase dashboard
2. Settings → Integrations → Slack
3. Connect to your Slack workspace
4. Enable alerts

### API Monitoring
1. Use Uptime monitoring services:
   - UptimeRobot (free tier)
   - Healthchecks.io
   - Checkly

## 📈 Step 8: Monitor Performance

### Analyze Free Tier Usage

```bash
# Check Supabase usage
curl -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  https://api.supabase.co/v1/projects/YOUR_PROJECT_ID/stats

# Check Groq API usage
curl https://api.groq.com/usage/YOUR_API_KEY
```

### Optimize Costs

1. **Supabase**: Use read replicas for high traffic
2. **Groq**: Monitor token usage, implement caching
3. **Vercel**: Use serverless functions for heavy tasks
4. **Puppeteer**: Use cloud-based screenshot services (use existing free APIs)

## ✅ Step 9: Verification Checklist

- [ ] Frontend deployed and accessible
- [ ] Backend API deployed and responding
- [ ] Supabase database connected
- [ ] Authentication working
- [ ] Can add websites
- [ ] Scans triggering automatically
- [ ] Recharts dashboards displaying
- [ ] Issues appearing in list
- [ ] HTTPS working everywhere
- [ ] Monitoring tools integrated

## 🎉 Congratulations!

Your SiteWard application is now live in production! 🚀

### Next Steps

1. Create demo accounts
2. Add test websites
3. Verify agent functionality
4. Set up notifications
5. Create demo video
6. Share with beta users

## 📞 Support & Troubleshooting

### Common Issues

**"CORS error in browser"**
- Check CORS configuration in backend
- Update `origin` with your frontend URL

**"Database connection failed"**
- Verify Supabase URL and key
- Check Supabase project is running
- Check RLS policies

**"Groq API rate limit"**
- Implement caching for responses
- Use cheaper models for batch operations
- Consider Groq Pro tier for higher limits

**"Images not loading"**
- Ensure HTTPS everywhere
- Check image URLs are accessible
- Verify CORS for CDN

## 📚 Additional Resources

- Vercel Docs: https://vercel.com/docs
- Supabase Docs: https://supabase.com/docs
- Groq Docs: https://console.groq.com/docs
- Railway Docs: https://docs.railway.app
- Render Docs: https://render.com/docs

---

**Happy deploying! Your SiteWard is now ready for the world!** 🌍
