# Test Suite Documentation

Comprehensive test coverage for the bookkeeping platform using Playwright (E2E), Vitest (Unit), and React Testing Library (Components).

## Test Structure

```
tests/
├── __mocks__/          # Mock implementations
├── api/                # API endpoint tests
├── business-logic/     # Core business logic tests
├── components/         # React component tests
├── e2e/               # End-to-end tests
├── unit/              # Unit tests
└── setup.ts           # Test configuration
```

## Running Tests

### All Tests
```bash
npm run test
```

### By Type
```bash
npm run test:unit      # Unit tests only
npm run test:e2e       # E2E tests only
npm run test:coverage  # With coverage report
```

### Specific Files
```bash
# Run a specific test file
npm test tests/api/analytics/top-vendors.test.ts

# Run tests matching a pattern
npm test -- --grep "cash flow"
```

## E2E Tests (`/e2e`)

### `comprehensive-bookkeeping-test.spec.ts`
Full user journey through the bookkeeping module:
- Dashboard navigation
- Transaction management
- Chart of accounts
- Reconciliation workflow

### `comprehensive-module-tests.spec.ts`
Tests all modules integration:
- Finance dashboard
- Analytics module
- Cash flow forecasting
- Cross-module navigation

### `cashflow-dashboard.spec.ts`
Cash flow module specific tests:
- 90-day forecast rendering
- Scenario switching
- Tax calculations
- Chart interactions

### `financial-calculations.spec.ts`
Validates financial calculations:
- Quick ratio
- Profit margins
- Cash flow projections
- Health scores

## API Tests (`/api`)

### `analytics/top-vendors.test.ts`
Tests vendor analytics endpoint:
- Ranking calculation
- Growth metrics
- Pagination
- Error handling

### `chart-of-accounts.test.ts`
Chart of accounts API testing:
- Account hierarchy
- Balance calculations
- Tax rate mapping

### `vat-account-balance.test.ts`
VAT calculation validation:
- Tax liability computation
- Multi-rate handling
- Period calculations

## Business Logic Tests (`/business-logic`)

### `cashflow-engine.spec.ts`
Core forecasting engine tests:
- Pattern detection
- Scenario modeling
- Tax obligation calculations
- Working capital optimization

### `uk-tax-calculator.spec.ts`
UK tax calculation accuracy:
- VAT calculations
- Corporation tax
- PAYE computations
- Tax thresholds

### `budget-import-export.spec.ts`
Budget management functionality:
- Excel import parsing
- Export formatting
- Data validation
- Error handling

## Component Tests (`/components`)

### `analytics/analytics-page.test.tsx`
Analytics UI component testing:
- Chart rendering
- Data loading states
- User interactions
- Export functionality

### `analytics/vendors-page.test.tsx`
Vendor dashboard components:
- Table sorting
- Filtering
- Pagination
- Detail views

## Mock Strategy

### Database Mocks (`__mocks__/prisma.ts`)
- Mocks Prisma client for unit tests
- Provides consistent test data
- Isolates database dependencies

### API Mocks (`__mocks__/redis.ts`)
- Mocks Redis client
- Simulates caching behavior
- Tests fallback mechanisms

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Data Factories**: Use consistent test data generators
3. **Async Handling**: Properly await all async operations
4. **Cleanup**: Always cleanup after tests
5. **Descriptive Names**: Use clear test descriptions

## Coverage Goals

- **Unit Tests**: 80% coverage minimum
- **Integration**: All API endpoints
- **E2E**: Critical user paths
- **Edge Cases**: Error states, empty data, limits

## Debugging Tests

### Playwright UI Mode
```bash
npm run test:e2e:ui
```

### Headed Mode
```bash
npm run test:e2e -- --headed
```

### Debug Single Test
```bash
npm run test:e2e -- --debug tests/e2e/specific-test.spec.ts
```

### VSCode Integration
- Install Playwright extension
- Use test explorer panel
- Set breakpoints in tests