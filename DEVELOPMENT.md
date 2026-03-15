# Development Guide for SiteWard

This guide helps you develop and test SiteWard locally.

## 🛠️ Local Development Setup

### 1. Start Backend Server

```bash
cd siteward-backend

# Install dependencies (if not done)
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run dev
```

Backend runs on `http://localhost:5000`

### 2. Start Frontend Development Server

```bash
cd siteward-frontend

# Install dependencies (if not done)
npm install

# Copy and configure environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Start development server
npm run dev
```

Frontend runs on `http://localhost:5173` (or next available port)

### 3. Create Test Account

1. Open http://localhost:5173
2. Sign up with test account:
   - Email: `test@example.com`
   - Password: `TestPassword123!`

## 🧪 Testing Agents

### Test MonitorAgent

```bash
curl -X POST http://localhost:5000/api/websites \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "url": "https://example.com",
    "name": "Example Website",
    "frequency": "hourly"
  }'
```

### Trigger Manual Scan

```bash
curl -X POST http://localhost:5000/api/websites/WEBSITE_ID/scan \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Check Scan Results

```bash
curl http://localhost:5000/api/websites/WEBSITE_ID/scans \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Issues

```bash
curl http://localhost:5000/api/websites/WEBSITE_ID/issues \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🐛 Debugging

### Enable Debug Logging

Set environment variable:

```bash
export DEBUG=siteward:*
npm run dev
```

### Inspect Database

Use Supabase Studio:
1. Go to Supabase dashboard
2. Click "SQL Editor"
3. Run queries to inspect data

### Test Groq API

```bash
curl https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_GROQ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mixtral-8x7b-32768",
    "messages": [{"role": "user", "content": "Hello!"}],
    "temperature": 0.7,
    "max_tokens": 100
  }'
```

## 📱 Testing Different Scenarios

### Test Broken Links

Create test website with broken links:

```html
<a href="https://example.com/nonexistent">Broken Link</a>
```

### Test Performance Issues

Add slow-loading assets:

```html
<img src="https://via.placeholder.com/2000x2000" />
```

### Test Security Issues

Monitor for patterns in source code:

```html
<script>
  const apiKey = "sk_live_abc123"; // Will be detected
</script>
```

### Test SEO Issues

Missing alt text, meta tags:

```html
<img src="image.jpg" /> <!-- Missing alt text -->
```

## 🔄 Continuous Testing

### Run Linter

```bash
cd siteward-backend
npm run lint  # If configured

cd ../siteward-frontend
npm run lint  # If configured
```

### Type Checking

```bash
cd siteward-backend
npm run typecheck
```

### Build for Production

```bash
# Backend
cd siteward-backend
npm run build

# Frontend
cd siteward-frontend
npm run build
```

## 📊 Monitoring Local Development

### Network Tab

1. Open browser DevTools (F12)
2. Go to Network tab
3. Trigger scans and monitor API calls
4. Check response times

### Console Logs

- Backend logs appear in terminal
- Frontend logs appear in browser console
- Use `console.log()` for debugging

### Database Inspection

Use Supabase dashboard to inspect:
- Websites table
- Scan results
- Issues
- Users

## 🚀 Hot Reload

Both frontend and backend support hot reload:

- **Frontend**: Edit React components and see changes instantly
- **Backend**: Edit TypeScript files and server restarts automatically

## 💾 Local Database Setup

### Using Supabase Local

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize local Supabase
supabase init

# Start local instance
supabase start
```

This creates a local PostgreSQL database for development.

## 🔑 Environment Variables for Testing

Create `.env.test` files:

**siteward-backend/.env.test:**
```
PORT=5001
NODE_ENV=test
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
```

**siteward-frontend/.env.test:**
```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
VITE_API_URL=http://localhost:5001/api
```

## 📝 Git Workflow

```bash
# Create feature branch
git checkout -b feature/agent-improvements

# Make changes
git add .
git commit -m "Improve MonitorAgent performance"

# Push to GitHub
git push origin feature/agent-improvements

# Create Pull Request on GitHub
```

## 🧩 Testing with Different Websites

### Well-Formed Sites
- example.com
- google.com
- github.com

### Sites with Issues
- Example with broken links (use localhost if needed)
- Example with missing meta tags
- Example with unoptimized images

### Edge Cases
- Very large sites (>1000 links)
- Sites with authentication required
- Sites with JavaScript-heavy content

## 🎯 Pre-Deployment Checklist

- [ ] All agents working correctly
- [ ] No console errors in browser
- [ ] No backend errors in terminal
- [ ] Database queries optimized
- [ ] Groq API integration tested
- [ ] GitHub integration working
- [ ] Error handling in place
- [ ] Loading states working
- [ ] Responsive design tested
- [ ] Performance acceptable

## 📚 Useful Commands

```bash
# Install all dependencies
npm install

# Build everything
npm run build

# Format code (if configured)
npm run format

# Run tests (if configured)
npm run test

# Clean build cache
rm -rf dist node_modules
npm install
```

## 🆘 Troubleshooting

**Port already in use:**
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Or use different port
PORT=5001 npm run dev
```

**Module not found:**
```bash
# Reinstall node_modules
rm -rf node_modules package-lock.json
npm install
```

**Supabase connection fails:**
- Check Supabase project is running
- Verify credentials in .env
- Check internet connection

**Groq API errors:**
- Verify API key is valid
- Check rate limits haven't been exceeded
- Ensure request format is correct

---

Happy developing! 🎉
