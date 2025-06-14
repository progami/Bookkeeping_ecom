# Bookkeeping Application - Claude Code Documentation

## MANDATORY TESTING REQUIREMENTS 🚨

### TESTS MUST BE PASSED AFTER EVERY CODE CHANGE
**This is non-negotiable. Before responding to the user, you MUST:**
1. Run all UI tests with Playwright
2. Verify ALL pages load without errors
3. Test ALL interactive elements
4. Fix any errors before proceeding

### Comprehensive Testing Checklist
- [ ] Start dev server: `npm run dev`
- [ ] Test all pages load without errors
- [ ] Test all buttons are clickable
- [ ] Test navigation between pages
- [ ] Check browser console for errors
- [ ] Verify TypeScript compilation
- [ ] Test Xero authentication flow
- [ ] Confirm data loads from database

## Overview
This is a Next.js bookkeeping application integrated with Xero API using a database-first architecture.

## Key Architecture Decisions
- **NO API CALLS INSIDE THE APP**: All data is fetched from the local SQLite database
- Initial sync from Xero happens on connect
- Manual refresh button for updates
- All app pages query from local database only

## Development Commands

### Start Development Server
```bash
npm run dev
```

### Code Quality Checks
```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Type check TypeScript
npm run type-check

# Run tests
npm test

# Run specific test file
npm test -- tests/api/analytics/top-vendors.test.ts
```

### Database Commands
```bash
# Run Prisma migrations
npm run prisma:migrate

# Open Prisma Studio
npm run prisma:studio

# Generate Prisma client
npm run prisma:generate
```

## Important Notes

### Authentication
- Real Xero credentials are used (not mock auth)
- OAuth flow redirects to `/api/v1/xero/callback`

### Performance
- Rate limiting is implemented using Bottleneck
- Redis datastore was disabled due to performance issues
- Caching only stores response.body to avoid circular references

### Database Schema
- SQLite database stores:
  - Bank accounts
  - Bank transactions
  - GL accounts (Chart of Accounts)
  - Sync logs

### Key API Endpoints
- `/api/v1/xero/sync` - Syncs all data from Xero
- `/api/v1/analytics/top-vendors` - Returns top vendors from database
- `/api/v1/xero/reports/balance-sheet` - Calculates from database
- `/api/v1/xero/account-transactions-ytd` - Returns YTD from database

## Testing
- Tests expect database queries, not Xero API calls
- Current test status: ~110 passing, ~29 failing (mostly UI component tests)

## UI Testing with Playwright

### Test All Pages
```typescript
const pagesToTest = [
  'https://localhost:3003/',
  'https://localhost:3003/finance',
  'https://localhost:3003/bookkeeping',
  'https://localhost:3003/bookkeeping/transactions',
  'https://localhost:3003/bookkeeping/chart-of-accounts',
  'https://localhost:3003/cashflow',
  'https://localhost:3003/analytics'
]

for (const url of pagesToTest) {
  await page.goto(url)
  await page.waitForLoadState('networkidle')
  // Check for console errors
  // Test all buttons
  // Verify data loads
}
```

### Authentication Testing
- Email: ajarrar@trademanenterprise.com
- Password: gW2r4*8&wFM.#fZ

### REMEMBER: TEST ALL UI ELEMENTS
1. Every button must be clicked
2. Every page must load
3. No console errors allowed
4. Data must display from database