# Bookkeeping Application - Claude Code Documentation

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