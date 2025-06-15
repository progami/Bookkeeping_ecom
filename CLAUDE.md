# Bookkeeping Application - Claude Code Documentation

## MANDATORY TESTING REQUIREMENTS 🚨

### TARGETED TESTING AFTER CODE CHANGES
**This is non-negotiable. Before responding to the user, you MUST:**
1. Identify which components/pages were modified
2. Run tests ONLY for the affected code
3. Test the specific functionality that was changed
4. Fix any errors before proceeding

### Targeted Testing Guidelines
- [ ] Start dev server: `npm run dev`
- [ ] Test ONLY the modified pages/components
- [ ] Test ONLY the changed functionality
- [ ] Check browser console for errors on affected pages
- [ ] Run TypeScript check: `npm run type-check`
- [ ] Run specific test files related to changes
- [ ] If authentication was modified, test auth flow
- [ ] If database queries changed, verify data loads

### Git Commit Best Practices
- [ ] Commit your work regularly (every 30-60 minutes or after completing a feature)
- [ ] Use descriptive commit messages that explain what changed
- [ ] Commit before switching to a different task
- [ ] Always commit working code - don't commit broken functionality

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

### Targeted Testing Approach
```typescript
// Only test the pages/components you modified
// Example: If you modified the finance page:
await page.goto('https://localhost:3003/finance')
await page.waitForLoadState('networkidle')
// Test only the specific changes made
```

### Testing Examples by Component

#### Finance Page Changes
```bash
npm test -- tests/e2e/comprehensive-bookkeeping-test.spec.ts -g "Finance Dashboard"
```

#### Bookkeeping Page Changes
```bash
npm test -- tests/e2e/comprehensive-bookkeeping-test.spec.ts -g "Bookkeeping Dashboard"
```

#### Analytics Page Changes
```bash
npm test -- tests/e2e/comprehensive-bookkeeping-test.spec.ts -g "Analytics Dashboard"
```

### Authentication Testing
- Email: ajarrar@trademanenterprise.com
- Password: gW2r4*8&wFM.#fZ

### TARGETED TESTING PRINCIPLES
1. Test ONLY what you changed
2. Run ONLY relevant test files
3. Check console errors ONLY on modified pages
4. Verify ONLY affected data displays