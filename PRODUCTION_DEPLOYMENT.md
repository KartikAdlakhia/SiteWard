# 🚀 Production Deployment Checklist

Complete this checklist to deploy SiteWard to production. Estimated time: **30 minutes**

## PHASE 1: Prepare Your Code (5 minutes)

### ✅ Step 1.1: Create GitHub Repository

```bash
# Navigate to your project
cd siteward

# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: SiteWard - AI Website Maintenance System"

# Create main branch
git branch -M main
```

### ✅ Step 1.2: Create GitHub Repository

1. Go to **https://github.com/new**
2. Repository name: `siteward`
3. Description: `AI-powered website maintenance for startups`
4. Public (recommended for portfolio)
5. Click **Create repository**

### ✅ Step 1.3: Push to GitHub

```bash
# Copy the HTTPS URL from GitHub (Code button)
# It will look like: https://github.com/YOUR_USERNAME/siteward.git

git remote add origin https://github.com/YOUR_USERNAME/siteward.git
git push -u origin main
```

Check: Go to your GitHub repo and see all files uploaded ✅

---

## PHASE 2: Set Up Production Database (5 minutes)

### ✅ Step 2.1: Create Production Supabase Project

1. Go to **https://supabase.com**
2. Click **New project**
3. Fill in:
   - Project name: `siteward-production`
   - Database password: Create strong password
   - Region: Choose closest to users
4. Wait for setup (~2 min)

### ✅ Step 2.2: Get Production Keys

1. In Supabase dashboard, go **Settings → API**
2. Copy and save:
   - **Project URL** → `SUPABASE_URL_PROD`
   - **anon key** → `SUPABASE_ANON_KEY_PROD`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_PROD` (for backend)

Keep these safe! You'll need them soon.

### ✅ Step 2.3: Set Up Database Schema

1. In Supabase: **SQL Editor**
2. Click **New Query**
3. Paste the SQL from README.md (the CREATE TABLE statements)
4. Click **RUN**
5. Verify tables created ✅

---

## PHASE 3: Deploy Frontend to Vercel (5 minutes)

### ✅ Step 3.1: Connect Vercel to GitHub

1. Go to **https://vercel.com**
2. Sign up with GitHub (or sign in)
3. Click **New Project**
4. Find and select `siteward` repository
5. Click **Import**

### ✅ Step 3.2: Configure Frontend Settings

**Framework & Build:**
- Framework: `Vite`
- Root Directory: `siteward-frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

Click **Continue**

### ✅ Step 3.3: Add Environment Variables

Add these to Vercel (Environment Variables section):

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxx...
VITE_API_URL=https://your-api-domain.com/api
```

**Replace with:**
- Your production Supabase URL
- Your production anon key
- Your backend API domain (you'll get this in Phase 4)

Click **Deploy**

### ✅ Step 3.4: Wait for Deployment

- Vercel builds and deploys automatically
- Takes ~2-3 minutes
- You'll get a URL like: `https://siteward.vercel.app`

**Copy this URL!** You'll use it in the next steps.

---

## PHASE 4: Deploy Backend API (10 minutes)

### Choose Your Backend Platform

I recommend **Railway.app** (easiest) or **Render.com** (also easy)

### Option A: Railway.app (Recommended)

#### Step 4A.1: Create Railway Account

1. Go to **https://railway.app**
2. Sign in with GitHub
3. Click **New Project**
4. Select **Deploy from GitHub repo**

#### Step 4A.2: Configure Railway

1. Select your `siteward` repository
2. Choose deploy directory: `siteward-backend`
3. Click **Deploy**

#### Step 4A.3: Add Environment Variables

In Railway dashboard, go to **Variables**:

```
PORT=5000
NODE_ENV=production
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxxxx...
GROQ_API_KEY=gsk_xxxxx...
GITHUB_TOKEN=ghp_xxxxx... (optional)
```

Click **Save**

#### Step 4A.4: Get Your API URL

Railway automatically gives you a domain like:
```
https://siteward-api.up.railway.app
```

Copy this! You'll need it for frontend.

### Option B: Render.com (Alternative)

#### Step 4B.1: Create Render Account

1. Go to **https://render.com**
2. Sign in with GitHub
3. Click **New +**
4. Select **Web Service**

#### Step 4B.2: Configure Render

1. Connect GitHub repo: `siteward`
2. Build command: `npm install && npm run build`
3. Start command: `npm start`
4. Environment: `Node`

#### Step 4B.3: Add Environment Variables

Same as Railway (see above)

#### Step 4B.4: Deploy

Click **Deploy** and wait ~3-5 minutes

---

## PHASE 5: Update Frontend with Backend URL (2 minutes)

### ✅ Step 5.1: Update Vercel Environment

1. Go to Vercel project
2. Settings → Environment Variables
3. Edit `VITE_API_URL`:
   ```
   https://your-api-domain.com/api
   ```
4. Redeploy: Click **Deployments → Redeploy** on latest

---

## PHASE 6: Verify Everything Works (3 minutes)

### ✅ Step 6.1: Test Frontend

1. Open your Vercel URL in browser
2. Should see SiteWard dashboard
3. Check browser console - no errors ✅

### ✅ Step 6.2: Test Backend API

```bash
# Test if backend is running
curl https://your-api-domain.com/api/health

# Should return:
# {"status":"ok","timestamp":"2026-03-15T..."}
```

### ✅ Step 6.3: Test Database Connection

1. In frontend, add a website
2. Fill in: `https://example.com`
3. Click "Add Website"
4. Check Supabase → websites table
5. Website should appear ✅

### ✅ Step 6.4: Test Agents

1. Click "Scan" button
2. Wait 30 seconds
3. Check **Issues** tab
4. Should see detected issues ✅

---

## PHASE 7: Final Setup (Optional but Recommended)

### ✅ Step 7.1: Set Up Uptime Monitoring

Ensure your app stays online. Use **UptimeRobot** (free):

1. Go to **https://uptimerobot.com**
2. Click **Create Monitor**
3. Choose **HTTP(s)**
4. URL: `https://your-api-domain.com/api/health`
5. Check interval: 5 minutes
6. Click **Create**

### ✅ Step 7.2: Set Up Error Tracking (Optional)

Use **Sentry.io** (free tier):

1. Go to **https://sentry.io**
2. Create new project
3. Select Node.js
4. Follow setup instructions
5. Add Sentry key to backend .env

### ✅ Step 7.3: Monitor Groq API Usage

1. Go to **https://console.groq.com**
2. Check **Usage** page
3. Set budget alerts if needed

---

## POST-DEPLOYMENT CHECKLIST

- [ ] Frontend loads at Vercel URL
- [ ] No console errors in browser
- [ ] Backend API responds to health check
- [ ] Can add websites in production
- [ ] Agents run and detect issues
- [ ] Supabase dashboard shows data
- [ ] Environment variables are secret (not in code)
- [ ] HTTPS working everywhere
- [ ] Monitoring set up
- [ ] GitHub repo public/private as desired

---

## YOUR PRODUCTION URLS

After deployment, you'll have:

```
Frontend: https://your-app.vercel.app
Backend:  https://your-api-domain.com
Database: https://xxxxx.supabase.co
```

Save these!

---

## TROUBLESHOOTING DEPLOYMENT

### "Frontend loads but shows error"
→ Check `VITE_API_URL` is correct in Vercel environment variables
→ Check backend is running (test health endpoint)

### "API returns 404"
→ Verify backend build command is correct
→ Check `PORT=5000` in environment variables
→ Verify routes are in `src/index.ts`

### "Database connection failed in production"
→ Verify `SUPABASE_URL` and keys are correct
→ Check RLS policies aren't blocking
→ Verify production database schema exists

### "Agents not running"
→ Check `GROQ_API_KEY` is valid
→ Verify backend logs (Railway/Render dashboard)
→ Check rate limits haven't been hit

### "Everything was working, now broken"
→ Check Vercel/Railway logs
→ Verify environment variables haven't changed
→ Check Supabase project status
→ Test health endpoint: `curl https://api-domain/api/health`

---

## WHAT'S NEXT AFTER DEPLOYMENT

1. ✅ **Share your app**
   - Get feedback from users
   - Test with real websites

2. ✅ **Monitor usage**
   - Check Supabase usage
   - Monitor Groq API calls
   - Track errors in logs

3. ✅ **Create demo video**
   - Record 60-second demo
   - Show broken site → fixed
   - Share on GitHub, LinkedIn, portfolio

4. ✅ **Optimize for scale**
   - Cache Groq responses
   - Optimize database queries
   - Monitor free tier limits

5. ✅ **Add features**
   - Email notifications
   - Custom schedules
   - Webhook integration
   - Team accounts

---

## QUICK COMMAND REFERENCE

```bash
# Check production build works
cd siteward-backend
npm run build

cd ../siteward-frontend
npm run build

# Test backend locally before deploying
PORT=5000 npm start

# View Vercel logs
vercel logs --prod

# View Railway logs
# (Go to Railway dashboard)
```

---

**Your SiteWard is now ready for the world!** 🚀

Next: Monitor your app and gather user feedback!
