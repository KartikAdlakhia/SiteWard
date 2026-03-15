# SiteWard Quick Reference

## 🚀 One-Minute Setup

```bash
# 1. Install everything
npm install

# 2. Copy env files
cp siteward-backend/.env.example siteward-backend/.env
cp siteward-frontend/.env.example siteward-frontend/.env.local

# 3. Edit .env files with your API keys
# - SUPABASE_URL, SUPABASE_ANON_KEY
# - GROQ_API_KEY
# - (Optional) GITHUB_TOKEN

# 4. Set up Supabase database schema (SQL in README.md)

# 5. Run it!
npm run dev

# Frontend: http://localhost:5173
# Backend: http://localhost:5000
```

## 📚 Essential Files

| File | Purpose |
|------|---------|
| `README.md` | Full documentation |
| `DEPLOYMENT.md` | Deploy to production |
| `DEVELOPMENT.md` | Development workflow |
| `PROJECT_SUMMARY.md` | High-level overview |
| `setup.sh` | Auto setup script |
| `.env.example` | Environment template |

## 🔌 API Endpoints Quick Reference

```bash
# Add website
POST /api/websites
Body: { url, name, frequency }

# Get websites
GET /api/websites

# Get single website
GET /api/websites/:id

# Get scan results
GET /api/websites/:id/scans

# Get issues
GET /api/websites/:id/issues

# Trigger scan
POST /api/websites/:id/scan

# Update issue
PATCH /api/issues/:id
Body: { status }

# Apply fix
POST /api/issues/:id/fix
```

## 🧠 Agent Functions

```typescript
// MonitorAgent
new MonitorAgent(url, websiteId).scan()
// Returns: { status, issues, data }

// PerformanceAgent
new PerformanceAgent(url, websiteId).scan()
// Returns: { status, issues, data }

// SecurityAgent
new SecurityAgent(url, websiteId).scan()
// Returns: { status, issues, data }

// ContentAgent
new ContentAgent(url, websiteId).scan()
// Returns: { status, issues, data }

// FixAgent
new FixAgent(websiteId).processIssues()
// Returns: { status, processedIssues, results }
```

## 📊 Dashboard Metrics

| Metric | Range | Good | Fair | Poor |
|--------|-------|------|------|------|
| Health Score | 0-100 | 80+ | 60-79 | <60 |
| Load Time | 0-5s | <2s | 2-3s | >3s |
| Uptime | 0-100% | >99% | 95-99% | <95% |
| Performance | 0-100 | >80 | 60-80 | <60 |

## 🔑 Environment Variables

### Backend (required)
```
PORT=5000
NODE_ENV=development
SUPABASE_URL=https://...supabase.co
SUPABASE_ANON_KEY=eyJ...
GROQ_API_KEY=gsk_...
GITHUB_TOKEN=ghp_... (optional)
```

### Frontend (required)
```
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=http://localhost:5000/api
```

## 🎯 Issue Types

```
broken_link   → Dead links (HTTP 4xx, 5xx)
performance   → Slow loading, poor scores
security      → Vulnerabilities, exposed keys
seo           → Missing meta tags, alt text
visual        → Layout shifts, regressions
```

## 🎨 Color Coding

| Status | Color | Meaning |
|--------|-------|---------|
| Healthy | Green (#10b981) | Everything OK |
| Warning | Amber (#f59e0b) | Has issues |
| Critical | Red (#ef4444) | Urgent action needed |
| Info | Blue (#3b82f6) | Informational |

## 📱 Mobile Testing Checklist

- [ ] Sidebar collapses on mobile
- [ ] Charts are responsive
- [ ] Buttons are touch-friendly
- [ ] Text is readable
- [ ] Forms work on small screens
- [ ] No horizontal scrolling

## ⚡ Performance Tips

```typescript
// Good: Batch database queries
const websites = await supabase
  .from('websites')
  .select('*')
  .eq('user_id', userId)
  .limit(50);

// Bad: Multiple sequential queries
for (const id of ids) {
  const data = await supabase
    .from('websites')
    .select('*')
    .eq('id', id);
}
```

## 🐛 Debug Commands

```bash
# Frontend console
localStorage.clear()
location.reload()

# Backend logs
export DEBUG=express:*
npm run dev

# Check Supabase connection
curl https://your-project.supabase.co/rest/v1/websites \
  -H "Authorization: Bearer YOUR_KEY"

# Test Groq API
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer YOUR_GROQ_KEY"
```

## 🚨 Troubleshooting

```
Error: CORS error
→ Check backend CORS config matches frontend URL

Error: Database connection failed
→ Check SUPABASE_URL and SUPABASE_ANON_KEY

Error: Groq rate limit exceeded
→ Wait 60 seconds, implement caching, or upgrade tier

Error: Port already in use
→ Kill process: lsof -ti:5000 | xargs kill -9

Error: Module not found
→ Reinstall: rm -rf node_modules && npm install
```

## 📈 Monitoring Commands

```bash
# Check frontend build size
cd siteward-frontend && npm run build
du -sh dist/

# Check backend memory
ps aux | grep node

# Check Supabase usage
# → Go to Supabase dashboard → Settings → Usage

# Check Groq usage
# → Go to https://console.groq.com → Usage
```

## 🔄 Update Workflow

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes and test
npm run dev

# 3. Build and test
npm run build

# 4. Commit
git add .
git commit -m "Add new feature"

# 5. Push
git push origin feature/new-feature

# 6. Create PR on GitHub
```

## 📦 Deployment Checklist

- [ ] All environment variables set
- [ ] Database schema created
- [ ] Supabase RLS policies enabled
- [ ] Frontend builds successfully
- [ ] Backend compiles without errors
- [ ] API endpoints responding
- [ ] HTTPS enabled
- [ ] Monitoring set up
- [ ] Backup strategy in place
- [ ] Load testing completed

## 💰 Free Tier Limits

| Service | Limit | Usage |
|---------|-------|-------|
| Supabase | 500MB DB | ~1000 websites |
| Groq | 30 req/min | ~4320 calls/day |
| Vercel | 100GB bandwidth | OK for MVP |
| GitHub | Unlimited | No limits |

## 🎓 Learning Resources

- React: https://react.dev
- Vercel: https://vercel.com/docs
- Supabase: https://supabase.com/docs
- Groq: https://console.groq.com/docs
- Recharts: https://recharts.org
- Express: https://expressjs.com

## 🏆 Best Practices

✅ Use TypeScript for type safety
✅ Implement error boundaries in React
✅ Cache API responses when possible
✅ Use indexes in database
✅ Implement rate limiting
✅ Monitor error logs
✅ Test before deploying
✅ Use environment variables
✅ Keep secrets secure
✅ Document your code

❌ Don't hardcode API keys
❌ Don't commit .env files
❌ Don't make unvalidated API calls
❌ Don't trust user input
❌ Don't make synchronous calls in React
❌ Don't use older versions of dependencies
❌ Don't forget to handle errors
❌ Don't expose sensitive data in logs

## 🎯 Key Metrics to Track

- **Response Time**: Target <500ms
- **Error Rate**: Target <0.1%
- **Uptime**: Target >99%
- **API Usage**: Monitor Groq quota
- **Database Performance**: Check query times
- **User Satisfaction**: Track feedback

---

**Quick commands:**
```bash
npm run dev        # Start development
npm run build      # Build for production
npm install        # Install dependencies
git status         # Check git status
```

**That's it! You're ready to build with SiteWard!** 🚀
