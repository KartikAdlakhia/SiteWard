# Render Deployment Guide for SiteWard Backend

## Why Render?

- **Completely free** (no 30-day limit like Railway)
- **Easy GitHub integration** (auto-deploys on push)
- **Good uptime** (just spins down after 15 min inactivity)
- **Production-ready** for our use case

## Deployment Steps

### Step 1: Prepare Your Backend

Your backend is already configured for Render. We have:
- `render.yaml` - Render deployment config
- `package.json` with proper build/start scripts
- TypeScript compilation to JavaScript

### Step 2: Deploy to Render

1. Go to **https://dashboard.render.com/**
2. Click **+ New** → **Web Service**
3. Select **Deploy an existing GitHub repository**
4. Search for: `KartikAdlakhia/SiteWard`
5. In the deployment form:
   - **Name**: `siteward-api`
   - **Root Directory**: `siteward-backend`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Plan**: Select **Free** (important!)

### Step 3: Add Environment Variables

Before clicking Deploy, scroll down and add these environment variables:

```
PORT=5000
NODE_ENV=production
SUPABASE_URL=https://jugdxfadqzsrihdhnsyw.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
GROQ_API_KEY=your-groq-api-key-here
GITHUB_TOKEN=your-github-token-here
```

### Step 4: Deploy

1. Click **Create Web Service**
2. Wait for build to complete (usually 3-5 minutes)
3. Once deployed, copy your URL from the top of the page
   - Format: `https://siteward-api.onrender.com`
4. **Save this URL** - you need it for frontend deployment!

### Step 5: Monitor Deployment

- Render shows real-time logs during build
- Green checkmark = success
- If it fails, check logs for errors

## Important Notes

### Cold Start Behavior
- After 15 minutes of inactivity, Render's free tier spins down the service
- First request after spin-down takes ~30 seconds (called "cold start")
- Subsequent requests are fast
- For a monitoring service this is fine since our scans happen regularly

### To Keep Service Always Warm (Optional)
If you want to avoid cold starts:
- Use UptimeRobot (free) to ping your API every 5 minutes
- Or upgrade to Render's paid tier

### Troubleshooting

**Service won't start?**
- Check build logs for TypeScript compilation errors
- Verify all environment variables are set
- Make sure `dist/index.js` exists after build

**API returns 404?**
- Verify your Render domain is correct
- Check that backend is running (should show "Live" in Render dashboard)

**Cannot connect to Supabase?**
- Verify SUPABASE_URL and SUPABASE_ANON_KEY are correct
- Make sure Supabase database schema was created
- Check Render logs for connection errors

## Verify It's Working

1. Go to your Render URL: `https://siteward-api.onrender.com/api/health`
2. You should see a response (or 404 if health endpoint isn't configured)
3. Copy the domain for frontend deployment

## Next Steps

Once this is deployed, deploy the frontend to Vercel using the domain from this step!
