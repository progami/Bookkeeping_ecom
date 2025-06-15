# Bookkeeping App - Development Guide

## 🚨 TESTING REQUIREMENTS
**Before responding to the user:**
1. Test ONLY modified code
2. Run TypeScript check: `npm run type-check`
3. Test specific functionality that changed
4. Fix errors before proceeding

**Browser Testing:**
1. Open https://localhost:3003 in browser
2. Navigate to modified pages
3. Check browser console for errors
4. Test actual functionality (click buttons, verify data)
5. Confirm visual elements render correctly

## 🔧 QUICK COMMANDS

### Development
```bash
npm run dev                # Start dev server
npm run lint:fix          # Fix linting
npm run type-check        # TypeScript check
```

### Testing Specific Components
```bash
# Finance page
npm test -- tests/e2e/comprehensive-bookkeeping-test.spec.ts -g "Finance Dashboard"

# Bookkeeping page  
npm test -- tests/e2e/comprehensive-bookkeeping-test.spec.ts -g "Bookkeeping Dashboard"

# Analytics page
npm test -- tests/e2e/comprehensive-bookkeeping-test.spec.ts -g "Analytics Dashboard"
```

### Database
```bash
npm run prisma:studio     # View database
npm run prisma:migrate    # Run migrations
```

## 📋 DEVELOPMENT WORKFLOW

1. **Multi-Agent Collaboration**
   - Multiple agents may work simultaneously on different modules
   - Stay within your assigned module to avoid conflicts
   - Possible overlap areas: shared components, API routes
   - Always pull latest changes before starting work

2. **Code Changes**
   - Make targeted modifications
   - Test only affected components
   - Check browser console on modified pages

3. **Git Commits**
   - Commit every 30-60 minutes
   - Use descriptive messages
   - Only commit working code

4. **Architecture Rules**
   - NO direct API calls - use local SQLite database
   - Data syncs from Xero on connect
   - All queries from local database

## 🔑 KEY INFO

### Xero Auth
- Real credentials (not mock)
- OAuth redirects to `/api/v1/xero/callback`
- Test credentials: ajarrar@trademanenterprise.com / gW2r4*8&wFM.#fZ

### Main API Endpoints
- `/api/v1/xero/sync` - Sync Xero data
- `/api/v1/analytics/top-vendors` - Vendor analytics
- `/api/v1/xero/reports/*` - Financial reports

### Performance
- Rate limiting with Bottleneck
- Response body caching only
- Redis disabled (performance issues)