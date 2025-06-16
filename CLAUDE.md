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

**Playwright Testing:**
1. Use Playwright for automated browser testing
2. Take screenshots during tests: `await page.screenshot({ path: 'screenshots/test-name.png' })`
3. ALWAYS save screenshots to the `screenshots/` folder
4. Use descriptive names for screenshots (e.g., 'finance-dashboard-loaded.png')
5. Include full page screenshots for important views: `fullPage: true`
6. **IMPORTANT**: Keep ONE browser session open to avoid repeated 2FA authentication
   - DO NOT close the browser between tests
   - Navigate between pages using the same session
   - Only close browser when completely done testing

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

### Playwright Browser Testing
When testing with Playwright tools:
```typescript
// Navigate to page
await playwright_navigate({ url: 'https://localhost:3003/finance' })

// Take screenshot - MUST save to screenshots folder
await playwright_screenshot({ 
  name: 'finance-dashboard',
  fullPage: true,
  savePng: true  // Saves to screenshots/ folder
})

// Check console for errors
await playwright_console_logs({ type: 'error' })

// Test interactions
await playwright_click({ selector: 'button.sync-button' })
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