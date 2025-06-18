# Broken Dependencies Audit Report

## Summary
This audit identifies all files with broken imports due to deleted files. The git status shows 123 deleted files, and this report focuses on TypeScript/JavaScript code files that are still being imported elsewhere.

## Critical Broken Imports

### 1. `lib/xero-client-with-rate-limit.ts` (DELETED)
**Files still importing this module:**
- `/app/api/v1/xero/sync/route.ts` - Line 5: `import { executeXeroAPICall, paginatedXeroAPICall } from '@/lib/xero-client-with-rate-limit';`
- `/lib/xero-data-manager.ts` - Line 3: `import { executeXeroAPICall } from '@/lib/xero-client-with-rate-limit';`
- `/lib/xero-report-fetcher.ts` - Line 2: `import { executeXeroAPICall } from './xero-client-with-rate-limit';`
- `/lib/xero-data-cache.ts` - Line 4: `import { executeXeroAPICall, paginatedXeroAPICall } from '@/lib/xero-client-with-rate-limit';`

**Impact**: These files rely on rate-limited Xero API calls. The functions `executeXeroAPICall` and `paginatedXeroAPICall` are NOT defined anywhere else in the codebase.

**Missing Functions**:
- `executeXeroAPICall` - Used by all 4 files
- `paginatedXeroAPICall` - Used by 2 files (sync/route.ts and xero-data-cache.ts)

**Existing Rate Limiting Infrastructure**:
- `lib/xero-rate-limiter.ts` - Contains `XeroRateLimiter` class with `executeAPICall` method
- This could potentially be used to implement the missing functions

## Other Deleted Code Files (No broken imports found)

The following code files were deleted but no imports were found in the codebase:
- `app/api-docs/page.tsx`
- `app/api/v1/system/health/route.ts`
- `app/api/v1/system/memory/route.ts`
- `app/api/v1/xero/reports/balance-sheet-live/route.ts`
- `app/api/v1/xero/reports/profit-loss-live/route.ts`
- `app/api/v1/xero/reports/vat-liability-live/route.ts`
- `app/database-schema/page.tsx`
- `components/auth/require-xero-connection.tsx`
- `components/ui/xero-connection-required.tsx`
- `lib/config/logging.config.ts`
- `lib/logger-enhanced.ts`
- `lib/page-configs.tsx`
- `playwright.config.ts`
- Various scripts in `scripts/` directory

## Recommendations

1. **Immediate Action Required**: 
   - Either restore `lib/xero-client-with-rate-limit.ts` or
   - Move the `executeXeroAPICall` and `paginatedXeroAPICall` functions to an existing module (possibly `lib/xero-client.ts` or `lib/xero-rate-limiter.ts`)
   - Update all imports in the 4 affected files

2. **Route Cleanup**: 
   - The deleted API routes (`/api/v1/system/health`, `/api/v1/system/memory`, etc.) appear to be cleanly removed with no dependencies

3. **Page Cleanup**: 
   - The deleted pages (`app/api-docs/page.tsx`, `app/database-schema/page.tsx`) have been cleanly removed

4. **Component Cleanup**: 
   - The deleted components (`require-xero-connection.tsx`, `xero-connection-required.tsx`) have been cleanly removed

## Additional Broken Dependencies

### 2. Test Infrastructure (DELETED)
**Deleted files:**
- `vitest.config.ts` - Vitest configuration
- `tests/` directory - All test files
- `playwright.config.ts` - Playwright configuration

**Broken scripts in package.json:**
- `"test": "vitest"` - Will fail without vitest.config.ts
- `"test:ui": "vitest --ui"` - Will fail without vitest.config.ts
- `"test:coverage": "vitest --coverage"` - Will fail without vitest.config.ts

**Impact**: All test commands will fail. The test infrastructure has been completely removed.

### 3. Configuration Files (DELETED)
**Deleted files:**
- `.editorconfig`
- `.eslintignore`
- `.prettierignore`
- `.prettierrc`
- `.nvmrc`

**Impact**: Development tooling may use defaults instead of project-specific configurations.

## Summary of Critical Issues

1. **Xero API Functions Missing**: 4 files are importing `executeXeroAPICall` and `paginatedXeroAPICall` from deleted `xero-client-with-rate-limit.ts`
2. **Test Infrastructure Removed**: All test files and configurations deleted, but test scripts remain in package.json
3. **Development Config Files Removed**: Various config files deleted but tooling still references them

## Immediate Actions Required

1. **Fix Xero API Calls** (CRITICAL):
   - Option A: Restore `lib/xero-client-with-rate-limit.ts`
   - Option B: Implement `executeXeroAPICall` and `paginatedXeroAPICall` in `lib/xero-rate-limiter.ts` or `lib/xero-client.ts`
   - Update imports in the 4 affected files

2. **Clean up package.json**:
   - Remove test scripts or restore test infrastructure
   - Update any scripts that reference deleted files

3. **Restore Development Configs** (Optional):
   - Restore config files if consistent development environment is needed

## Testing Required

After fixing the broken imports:
1. Test Xero sync functionality
2. Test Xero data fetching and caching
3. Test report generation that uses Xero data
4. Verify all API endpoints are functional