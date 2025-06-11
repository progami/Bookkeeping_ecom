# Bookkeeping Application Test Suite

## Overview

This test suite provides comprehensive coverage for the bookkeeping application, including UI testing, business logic validation, and integration testing.

## Test Structure

```
tests/
├── e2e/                    # End-to-end UI tests
├── business-logic/         # Business logic and calculation tests
├── helpers/               # Test utilities and helpers
│   ├── mock-api.ts       # API mocking for Xero integration
│   └── toast-helper.ts   # Toast notification testing utilities
└── mocks/                # Mock data
    └── xero-mock-data.ts # Xero API mock responses
```

## Test Categories

### 1. UI Tests (180+ elements)
- **Coverage**: 100% of interactive elements
- **Location**: `tests/e2e/`
- **Key Files**:
  - `common-ui-elements.spec.ts` - Common UI patterns
  - `accessibility-complete.spec.ts` - WCAG compliance
  - `*-complete.spec.ts` - Page-specific comprehensive tests

### 2. Business Logic Tests
- **Location**: `tests/business-logic/`
- **Coverage**:
  - SOP generation algorithms
  - Rule engine and priority system
  - Tax calculations and reconciliation
  - Account balance calculations

### 3. Integration Tests
- **Mock Strategy**: Full Xero API mocking
- **Helper**: `setupXeroMocks()` in `helpers/mock-api.ts`
- **Coverage**: OAuth flow, data sync, transaction management

## Running Tests

### Local Development

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Run all tests
npm test

# Run specific test category
npx playwright test tests/e2e/
npx playwright test tests/business-logic/

# Run tests in UI mode
npx playwright test --ui

# Run specific test file
npx playwright test tests/e2e/transactions-complete.spec.ts
```

### CI/CD

Tests run automatically on:
- Every push to `main` or `develop`
- Every pull request
- Daily scheduled runs at 2 AM UTC

## Writing Tests

### UI Test Example

```typescript
import { test, expect } from '@playwright/test'
import { setupXeroMocks } from '../helpers/mock-api'

test('should display transactions', async ({ page }) => {
  // Setup mocks
  await setupXeroMocks(page)
  
  // Navigate
  await page.goto('/bookkeeping/transactions')
  
  // Assert
  await expect(page.locator('table')).toBeVisible()
})
```

### Business Logic Test Example

```typescript
test('should calculate GST correctly', async ({ page }) => {
  const amount = 100
  const gstRate = 0.15
  const expectedGST = amount * gstRate / (1 + gstRate)
  
  // Test implementation
})
```

## Mock Data

The test suite uses comprehensive mock data to simulate Xero integration:

- Bank accounts
- Transactions (income/expenses)
- GL accounts
- Tax rates

See `tests/mocks/xero-mock-data.ts` for details.

## Best Practices

1. **Use Page Object Model** for complex pages
2. **Mock external APIs** to ensure test reliability
3. **Use data-testid** attributes for stable selectors
4. **Group related tests** using `describe` blocks
5. **Keep tests independent** - each test should be runnable in isolation

## Debugging

```bash
# Run tests in debug mode
npx playwright test --debug

# Run with specific browser
npx playwright test --project=chromium

# Generate test report
npx playwright show-report
```

## GitHub Actions

### Workflows

1. **test.yml** - Main test suite
2. **scheduled-tests.yml** - Daily comprehensive tests
3. **pr-checks.yml** - Pull request validation

### Test Sharding

E2E tests are sharded across 4 parallel jobs for faster execution:

```yaml
strategy:
  matrix:
    shard: [1, 2, 3, 4]
```

## Troubleshooting

### Common Issues

1. **Xero connection required**: Use `setupXeroMocks()` to mock the API
2. **Toast timing**: Use `expectSuccessToast()` helper for reliable toast testing
3. **Flaky tests**: Add appropriate `waitFor` conditions

### Environment Variables

Required for tests:
```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

## Coverage Report

Current coverage:
- **UI Elements**: 180/180 (100%)
- **Business Logic**: Comprehensive
- **Accessibility**: WCAG 2.1 AA compliant
- **Performance**: Lighthouse CI integrated