# Production Deployment Steps

## Phase 1: Supabase Database Setup (5 minutes)

1. Go to https://app.supabase.com/projects
2. Select your Siteward project (jugdxfadqzsrihdhnsyw)
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `SUPABASE_SETUP.sql` from this repository
6. Paste into the SQL editor
7. Click **Run**
8. Wait for confirmation message: "SUCCESS"

✅ Your database is now ready!

---

## Phase 2: Deploy Backend to Render (5 minutes)

1. Go to https://dashboard.render.com/
2. Click **+ New** → **Web Service**
3. Select **Deploy an existing GitHub repository**
4. Connect your GitHub account if needed
5. Search for and select: `KartikAdlakhia/SiteWard`
6. Fill in the deployment settings:
   - **Name**: `siteward-api`
   - **Root Directory**: `siteward-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start` (or `node dist/index.js`)
7. Click **Advanced** and add these environment variables:
   ```
   PORT=5000
   NODE_ENV=production
   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   SUPABASE_ANON_KEY=your-supabase-anon-key-here
   GROQ_API_KEY=your-groq-api-key-here
   GITHUB_TOKEN=your-github-token-here
   ```
8. Under **Plan**: Select **Free** (important!)
9. Click **Create Web Service**
10. Wait for the deployment to complete (3-5 minutes)
11. Copy your Render URL from the top of the page (e.g., `siteward-api.onrender.com`)
12. **IMPORTANT**: Save this URL - you'll need it for the frontend!

✅ Backend is now live on Render (free tier)!

**Note**: Render's free tier will spin down after 15 minutes of inactivity. This means the first request after inactivity takes ~30 seconds to respond. This is fine for a monitoring service that makes regular requests.

---

## Phase 3: Deploy Frontend to Vercel (5 minutes)

1. Go to https://vercel.com/dashboard
2. Click **Add New** → **Project**
3. Search for and select: `KartikAdlakhia/SiteWard`
4. In the configuration:
   - **Framework Preset**: Vite
   - **Root Directory**: `siteward-frontend`
   - **Build Command**: `npm run build`
   - **Install Command**: `npm install`
5. Click **Environment Variables** and add:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
   VITE_API_URL=https://YOUR-RENDER-DOMAIN/api
   ```
   (Replace `YOUR-RENDER-DOMAIN` with the domain from Phase 2! e.g., `siteward-api.onrender.com`)
6. Click **Deploy**
7. Wait for the deployment to complete
8. Copy your Vercel domain from the success page

✅ Frontend is now live!

---

## Phase 4: Test Production Deployment (5 minutes)

1. Open your Vercel frontend URL in your browser
2. You should see the SiteWard dashboard
3. Click **Add Website**
4. Enter a test URL (e.g., `https://example.com`)
5. Click **Add**
6. Click **Scan Now** on the website card
7. Wait 10-15 seconds for the scan to complete
8. Check if issues appear in the **Issues** tab

✅ If you see issues, your entire system is working!

---

## Verification Checklist

- [ ] Supabase SQL schema executed successfully
- [ ] Railway backend deployed and domain copied
- [ ] Vercel frontend deployed with Railway domain in env vars
- [ ] Frontend loads without errors
- [ ] Can add a website
- [ ] Can trigger a scan
- [ ] Issues appear in the dashboard

---

## Troubleshooting

### Frontend shows "Cannot reach API"
- Check that `VITE_API_URL` in Vercel matches your Railway domain
- Make sure Railway backend is still running (check Railway dashboard)
- Verify CORS is enabled in backend (it is by default)

### Backend deployment fails
- Check Railway logs for errors
- Verify all environment variables are set correctly
- Make sure `siteward-backend` is set as root directory

### Database connection error
- Verify Supabase credentials are correct
- Check that SQL schema was executed without errors
- Look at Supabase logs for connection issues

---

## Next Steps (Optional)

- Set up monitoring: https://uptimerobot.com (free tier)
- Add email notifications: https://resend.com
- Create a custom domain for frontend
- Set up CI/CD pipeline on GitHub
