# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive financial management platform built with Next.js 14, featuring real-time Xero integration and advanced analytics for UK businesses.

**Tech Stack:**
- Frontend: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- Backend: Next.js API Routes, Prisma ORM, SQLite
- Authentication: JWT with HTTP-only cookies
- External Integration: Xero Accounting API

## Essential Commands

### Development
```bash
npm run dev          # Start HTTPS dev server on port 3003
npm run dev:http     # Start HTTP dev server (fallback)
npm run build        # Build for production
npm run start        # Start production server
```

### Code Quality
```bash
npm run lint         # Run ESLint
npm run lint:fix     # Fix linting issues
npm run format       # Format code with Prettier
npm run type-check   # Run TypeScript compiler check
```

### Testing
```bash
npm test             # Run unit tests with Vitest
npm run test:ui      # Run tests with UI
npm run test:coverage # Generate coverage report
npx playwright test  # Run E2E tests
npx playwright test --ui # Run E2E tests with UI
```

### Database Management
```bash
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio GUI
npm run db:reset        # Reset database (scripts/reset-database.ts)
```

### Logging
```bash
npm run logs         # View logs interactively
npm run logs:tail    # Tail logs in real-time
npm run logs:errors  # View only error logs
```

## High-Level Architecture

### Authentication Flow
1. **User Registration/Login** (`/api/v1/auth/*`)
   - JWT tokens stored in HTTP-only cookies (`user_session`)
   - Middleware enforces auth on protected routes (middleware.ts:38-120)
   - Session validation in lib/auth/session-validation.ts

2. **Xero OAuth Integration** (`/api/v1/xero/auth/*`)
   - OAuth 2.0 + PKCE flow implementation
   - Token storage in database (encrypted in production)
   - Automatic token refresh with lock mechanism (lib/xero-client.ts:126-180)
   - Rate limiting with Bottleneck (lib/xero-rate-limiter.ts)

### Data Architecture
- **Database-First Design**: All Xero data synced to local SQLite/PostgreSQL
- **Models**: User, BankTransaction, Invoice, Contact, GLAccount, etc. (prisma/schema.prisma)
- **Sync Strategy**: 
  - Initial full sync on setup
  - Delta syncs using lastModifiedUtc timestamps
  - Lock mechanism prevents concurrent syncs (lib/sync-lock.ts)

### Module Structure
1. **Finance Dashboard** (`/finance`) - Overview and navigation hub
2. **Bookkeeping** (`/bookkeeping`) - Transaction management, SOP generation
3. **Cash Flow** (`/cashflow`) - 90-day forecasting with scenarios
4. **Analytics** (`/analytics`) - Spending insights and vendor analysis

### API Design Patterns
- RESTful endpoints under `/api/v1/*`
- Consistent error handling (lib/errors/error-handler.ts)
- Input validation with Zod schemas (lib/validation/schemas.ts)
- Structured logging with context (lib/logger.ts)

### Key Services
- **Xero Sync** (lib/xero-sync.ts): Handles data synchronization
- **Cash Flow Engine** (lib/cashflow-engine.ts): Forecast calculations
- **UK Tax Calculator** (lib/uk-tax-calculator.ts): VAT, PAYE, Corporation Tax
- **Queue Manager** (lib/queue/queue-manager.ts): Background job processing

## Important Context

### Environment Configuration
- Always use HTTPS in development (self-signed certs in certificates/)
- Xero requires HTTPS redirect URIs
- Configure logging via LOG_* env variables (see .env.example)

### Dark Theme Enforcement
- All pages use dark theme by default (slate-900 background)
- Theme is set in contexts/ThemeContext.tsx
- UI components use dark-compatible color schemes

### Error Handling
- Global error boundary in app/error.tsx
- API routes return consistent error formats
- Xero API errors handled with retry logic

### Performance Considerations
- Database queries optimized with indexes
- API responses cached where appropriate
- Large datasets use pagination
- React Query for client-side caching

### Security
- All sensitive data encrypted in production
- CSRF protection via SameSite cookies
- Input sanitization on all user inputs
- Rate limiting on API endpoints

## Code Style

- TypeScript strict mode enabled
- Functional components with hooks
- Async/await over promises
- Descriptive variable names
- Early returns for guard clauses
- Prefer composition over inheritance

## Testing Approach

- Unit tests for business logic (Vitest)
- Integration tests for API endpoints
- E2E tests for critical user flows (Playwright)
- Test database separate from development

## Common Tasks

### Adding a New API Endpoint
1. Create route file in `app/api/v1/[module]/[endpoint]/route.ts`
2. Add Zod schema in `lib/validation/schemas.ts`
3. Implement with error handling and logging
4. Add to OpenAPI spec if public

### Modifying Database Schema
1. Update `prisma/schema.prisma`
2. Run `npm run prisma:migrate`
3. Update related TypeScript types
4. Update affected API endpoints

### Debugging Xero Integration
1. Enable Xero logging: `LOG_XERO=true`
2. Check token expiry in XeroSession
3. Verify webhook signatures if applicable
4. Use Xero API Explorer for testing