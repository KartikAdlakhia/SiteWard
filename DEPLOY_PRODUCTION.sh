#!/bin/bash

# SiteWard Production Deployment Guide
# This script helps you deploy to Railway and Vercel

echo "🚀 SiteWard Production Deployment"
echo "=================================="
echo ""

# Step 1: Verify environment variables
echo "✅ Step 1: Environment Variables"
echo "Backend .env created with credentials"
echo "Frontend .env.production created with credentials"
echo ""

# Step 2: Deployment to Railway
echo "📦 Step 2: Deploy Backend to Railway"
echo ""
echo "1. Go to https://railway.app/"
echo "2. Sign in with GitHub"
echo "3. Create a new project → Deploy from GitHub repo"
echo "4. Select: KartikAdlakhia/SiteWard"
echo "5. Select root directory: siteward-backend"
echo ""
echo "6. Add these environment variables:"
echo "   - PORT=5000"
echo "   - NODE_ENV=production"
echo "   - SUPABASE_URL=https://jugdxfadqzsrihdhnsyw.supabase.co"
echo "   - SUPABASE_ANON_KEY=(your anon key)"
echo "   - GROQ_API_KEY=(your Groq API key)"
echo "   - GITHUB_TOKEN=(your GitHub token)"
echo ""
echo "7. Click Deploy"
echo "8. Once deployed, copy your domain (e.g., siteward-api.railway.app)"
echo ""

# Step 3: Deployment to Vercel
echo "🎨 Step 3: Deploy Frontend to Vercel"
echo ""
echo "1. Go to https://vercel.com/"
echo "2. Sign in with GitHub"
echo "3. Click 'New Project'"
echo "4. Select repository: KartikAdlakhia/SiteWard"
echo "5. Configure:"
echo "   - Framework: Vite"
echo "   - Root directory: siteward-frontend"
echo "   - Build command: npm run build"
echo "   - Install command: npm install"
echo ""
echo "6. Add these environment variables:"
echo "   - VITE_SUPABASE_URL=https://jugdxfadqzsrihdhnsyw.supabase.co"
echo "   - VITE_SUPABASE_ANON_KEY=(your anon key)"
echo "   - VITE_API_URL=https://YOUR-RAILWAY-DOMAIN/api"
echo ""
echo "7. Click Deploy"
echo ""

# Step 4: Testing
echo "✨ Step 4: Test Production"
echo ""
echo "1. Open your Vercel frontend URL in browser"
echo "2. Add a test website"
echo "3. Click 'Scan Now'"
echo "4. Check if issues appear"
echo ""

echo "🎉 Deployment Complete!"
