# 🚀 Getting Started with SiteWard

Welcome! This guide will get you up and running in **less than 5 minutes**.

## What You'll Need

- Node.js 18+ (Get it: https://nodejs.org)
- Supabase account (Free: https://supabase.com)
- Groq API key (Free: https://console.groq.com)
- A code editor (VS Code recommended)

## Step 1: Clone the Project

```bash
# The project is ready in your current directory
cd siteward
```

## Step 2: Install Dependencies (2 minutes)

```bash
# This installs everything automatically
npm install
```

**What it does:**
- Installs backend packages (Express, Supabase, Groq, etc.)
- Installs frontend packages (React, Recharts, etc.)

## Step 3: Set Up Supabase (2 minutes)

### Create Supabase Project

1. Go to https://supabase.com
2. Click "Start your project"
3. Create account (if needed)
4. Create new project:
   - Name: `siteward`
   - Region: Select closest to you
   - Click "Create new project"
5. Wait for setup (takes ~1 minute)

### Get Your Keys

1. Go to **Settings** → **API**
2. Copy these values:
   - `Project URL` (under "Project URL")
   - `Anon key` (under "Anon key")

### Set Up Database Schema

1. In Supabase, go to **SQL Editor**
2. Click **New Query**
3. Paste this SQL:

```sql
-- Create tables
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

-- Create indexes
CREATE INDEX idx_scan_results_website_id ON scan_results(website_id);
CREATE INDEX idx_scan_results_created_at ON scan_results(created_at);
CREATE INDEX idx_issues_website_id ON issues(website_id);
CREATE INDEX idx_issues_status ON issues(status);
```

4. Click **RUN**
5. Done! ✅

## Step 4: Get Groq API Key (1 minute)

1. Go to https://console.groq.com
2. Sign up (if needed)
3. Go to **API Keys**
4. Click **Create API Key**
5. Copy your API key (starts with `gsk_`)

## Step 5: Configure Environment

### Backend Configuration

1. Open `siteward-backend/.env.example`
2. Create `siteward-backend/.env` with:

```bash
PORT=5000
NODE_ENV=development
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxxx...
GROQ_API_KEY=gsk_xxxx...
```

### Frontend Configuration

1. Open `siteward-frontend/.env.example`
2. Create `siteward-frontend/.env.local` with:

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxx...
VITE_API_URL=http://localhost:5000/api
```

**Replace the `xxx` parts with your actual keys!**

## Step 6: Start the App

Open two terminal tabs:

### Terminal 1: Start Backend

```bash
cd siteward-backend
npm run dev
```

You should see:
```
🚀 SiteWard API Server running on port 5000
```

### Terminal 2: Start Frontend

```bash
cd siteward-frontend
npm run dev
```

You should see:
```
Local:   http://localhost:5173
```

## Step 7: Open in Browser

1. Open http://localhost:5173 in your browser
2. You should see the SiteWard dashboard! 🎉

## Step 8: Add Your First Website

1. Click **"Add Website"** button
2. Enter:
   - URL: `https://example.com`
   - Name: `Example Website`
   - Frequency: `Hourly`
3. Click **"Add Website"**
4. The app starts monitoring automatically! ✅

## What Next?

### Explore the Dashboard
- View health score
- Check performance metrics
- See detected issues
- Browse scan results

### Test the Agents
1. Click on your website
2. Go to **Dashboard** tab to see metrics
3. Go to **Issues** tab to see detected problems
4. Try "Apply Fix" on an issue

### Try Different Websites
- Add your own website
- Try websites with different issues
- See how each agent responds

## Troubleshooting

### "CORS error" in browser console?
→ Make sure both backend and frontend are running

### "Database connection failed"?
→ Check your Supabase URL and keys in `.env` files

### "Module not found"?
→ Run `npm install` in both directories again

### "Port already in use"?
→ Change `PORT=5001` in backend `.env`

### Still stuck?
→ Check DEVELOPMENT.md for detailed debugging

## 📚 Next Steps

Ready for more? Check these files:

1. **README.md** - Complete documentation
2. **DEVELOPMENT.md** - Development workflow
3. **DEPLOYMENT.md** - Deploy to production
4. **QUICK_REFERENCE.md** - Quick command reference

## 🎯 Architecture Overview

```
Browser (React)
    ↓
Frontend Dashboard (Port 5173)
    ↓ (API Calls)
Backend Server (Port 5000)
    ↓
Supabase Database
+ Groq API
```

## 💡 Fun Things to Try

1. **Add Multiple Websites**
   - Monitor different types of sites
   - See how agents respond differently

2. **Trigger Manual Scans**
   - Click "Scan" button on website card
   - Watch results appear in real-time

3. **Analyze Issues**
   - Filter by severity
   - Check issue descriptions
   - See fix suggestions

4. **Monitor Performance**
   - Watch Recharts update
   - Check health score changes
   - Review scan history

## ✨ Features You Have

✅ Real-time website monitoring
✅ 5 AI agents analyzing your site
✅ Beautiful Recharts dashboards
✅ Issue detection and tracking
✅ Automated fix generation
✅ Mobile responsive design
✅ Completely free to run

## 🚀 Ready to Deploy?

Once you're happy with the app locally:

1. Check **DEPLOYMENT.md** for Vercel setup
2. Deploy frontend in 2 minutes
3. Deploy backend in 2 minutes
4. Your app is live worldwide! 🌍

## 📞 Need Help?

- **Getting started issues**: See DEVELOPMENT.md
- **Deployment questions**: See DEPLOYMENT.md
- **API documentation**: See README.md
- **Quick commands**: See QUICK_REFERENCE.md

---

**That's it! You now have a fully functional AI-powered website maintenance system.** 🎉

Go build something amazing! 🚀
