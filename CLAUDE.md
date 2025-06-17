# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working on this codebase.

## Project Overview

Financial management platform for UK businesses with Xero integration.

## Tech Stack

**Frontend:**
- Framework: Next.js 14 (App Router)
- UI: React 18, TypeScript, Tailwind CSS, shadcn/ui
- State: React Query, Context API
- Forms: React Hook Form + Zod validation

**Backend:**
- Runtime: Node.js with Next.js API Routes
- Database: SQLite (dev) / PostgreSQL (prod) with Prisma ORM
- Auth: JWT tokens in HTTP-only cookies
- Integration: Xero API with OAuth 2.0

## Multi-Agent Development Environment

**IMPORTANT:** Multiple developers may be working on this codebase simultaneously. Follow these guidelines:

1. **Task Isolation**: Only modify files directly related to your assigned task
2. **Testing**: ALWAYS verify your changes with Playwright screenshots before considering task complete
3. **Commits**: Make regular, focused commits with clear messages
4. **Scope**: Test ONLY features related to your specific task - do not test unrelated functionality

## Essential Commands

```bash
# Development
npm run dev          # HTTPS on port 3003 (required for Xero)
npm run build        # Production build
npm run lint         # Check code quality
npm run type-check   # TypeScript validation

# Testing (MANDATORY before task completion)
npx playwright test --ui  # Run E2E tests with UI
npx playwright test [test-name] --headed  # Run specific test visually

# Database
npm run prisma:generate  # Update Prisma client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Database GUI
```

## Development Workflow

1. **Before Starting**: Run `npm run dev` and verify app loads
2. **During Development**: 
   - Make incremental changes
   - Run `npm run lint` and `npm run type-check` regularly
   - Commit working code frequently
3. **Before Completion**:
   - Write/update Playwright tests for your feature
   - Capture screenshots proving functionality works
   - Ensure all linting/type checks pass

## Key Architecture Points

- **Authentication**: JWT middleware at middleware.ts:38-120
- **API Routes**: `/api/v1/*` with consistent error handling
- **Database Sync**: Xero data synced locally with lock mechanism
- **Dark Theme**: Enforced globally (slate-900 backgrounds)
- **Error Handling**: Global boundary + structured API responses

## Testing Requirements

Every feature MUST be verified with Playwright:

```typescript
// Example test structure
test('feature description', async ({ page }) => {
  await page.goto('/relevant-page');
  // Perform actions
  await expect(page).toHaveScreenshot('feature-working.png');
});
```

## Common Pitfalls to Avoid

1. Never modify unrelated files
2. Don't assume Xero sync is instant - check sync status
3. Always use HTTPS in dev (Xero requirement)
4. Test with both authenticated and unauthenticated states
5. Verify dark theme compatibility for all UI changes

## Quick Reference

- **Xero Token Refresh**: Automatic via lib/xero-client.ts
- **Rate Limiting**: Handled by lib/xero-rate-limiter.ts
- **Validation Schemas**: lib/validation/schemas.ts
- **Logging**: Use lib/logger.ts (never console.log)
- **Error Classes**: lib/errors/*