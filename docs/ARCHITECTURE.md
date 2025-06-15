# Architecture & Technical Documentation

## System Architecture

### Database-First Design Philosophy

The application follows a **database-first architecture** to optimize performance and reduce API dependencies:

1. **Data Sync Strategy**
   - All Xero data is synced to local SQLite database
   - Sync occurs on-demand via "Refresh" button or scheduled jobs
   - No direct API calls during normal user operations
   - Enables offline functionality and instant response times

2. **Benefits**
   - Reduced API rate limit consumption
   - Sub-millisecond query response times
   - Complex queries and aggregations without API limitations
   - Historical data retention beyond Xero's API limits

## Module Architecture

### 1. Finance Module (`/finance`)
**Architecture Pattern**: Dashboard Aggregator

```
┌─────────────────┐     ┌──────────────────┐
│  Finance Page   │────▶│  Multiple APIs   │
└─────────────────┘     └──────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│  Auth Context   │     │  Local Database  │
└─────────────────┘     └──────────────────┘
```

**Key Components**:
- `useAuth()` hook for authentication state
- Parallel API calls for performance
- Real-time metric calculations
- Module health monitoring

### 2. Bookkeeping Module (`/bookkeeping`)
**Architecture Pattern**: CRUD with Sync

```
┌─────────────────┐     ┌──────────────────┐
│ Transaction UI  │────▶│   Sync Engine    │
└─────────────────┘     └──────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│  Local CRUD Ops │◀────│   Xero API       │
└─────────────────┘     └──────────────────┘
```

**Sync Process**:
1. OAuth token validation
2. Paginated data fetching (100 records/page)
3. Upsert operations to prevent duplicates
4. Transaction status tracking

### 3. Cash Flow Module (`/cashflow`)
**Architecture Pattern**: Predictive Engine

```
┌─────────────────┐
│ Forecast Engine │
└────────┬────────┘
         │
    ┌────▼────┐
    │ Sources │
    └────┬────┘
         │
┌────────┼─────────────────────┐
│        │                     │
▼        ▼                     ▼
Invoices Bills    Historical Patterns
```

**Forecasting Algorithm**:
1. **Base Calculation**: Opening balance + confirmed transactions
2. **Pattern Detection**: Identifies repeating transactions
3. **Tax Obligations**: UK tax calculations (VAT, Corp Tax, PAYE)
4. **Scenario Modeling**: Conservative (80%), Base (100%), Optimistic (120%)

### 4. Analytics Module (`/analytics`)
**Architecture Pattern**: Data Warehouse Query

```
┌─────────────────┐     ┌──────────────────┐
│  Analytics UI   │────▶│  Query Engine    │
└─────────────────┘     └──────────────────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
                Aggregation  Grouping   Time Series
```

**Analytics Pipeline**:
1. Query local `bankTransaction` table
2. Group by vendor (`contactName`) or category
3. Calculate growth rates (current vs previous period)
4. Generate visualizations with Recharts

## Data Flow

### Authentication Flow
```
User ──▶ Login ──▶ Xero OAuth ──▶ Token Storage (Cookie) ──▶ App Access
                         │
                         └──▶ Tenant Selection ──▶ Organization Context
```

### Sync Flow
```
Trigger ──▶ Rate Limiter ──▶ Xero API ──▶ Transform ──▶ Database
   │              │                │           │            │
   │              ▼                ▼           ▼            ▼
Manual      Bottleneck      Pagination    Validation    Upsert
```

## Performance Optimizations

### 1. Database Optimizations
- Indexed fields: `xeroTransactionId`, `date`, `bankAccountId`, `contactName`
- Compound indexes for common queries
- Query result caching with Redis

### 2. Frontend Optimizations
- Code splitting with dynamic imports
- Prefetching on hover (module cards)
- Optimistic UI updates
- Virtual scrolling for large lists

### 3. API Optimizations
- Response caching headers
- Parallel data fetching
- Batch operations
- GraphQL-like field selection

## Security Architecture

### Authentication & Authorization
- **OAuth 2.0**: Xero authentication
- **JWT Storage**: HTTP-only secure cookies
- **CSRF Protection**: Token validation
- **Session Management**: 30-day expiry with refresh

### Data Security
- **Input Validation**: Zod schemas on all endpoints
- **SQL Injection**: Prevented by Prisma ORM
- **XSS Protection**: React's default escaping
- **Rate Limiting**: Bottleneck on API calls

### Infrastructure Security
- **HTTPS Only**: Self-signed certs for dev, proper SSL for prod
- **Environment Variables**: Sensitive data in `.env`
- **Error Handling**: No sensitive data in error messages

## Technology Stack

### Core
- **Framework**: Next.js 14.2.3 (App Router)
- **Language**: TypeScript 5.4.2
- **Database**: SQLite + Prisma ORM
- **Authentication**: Xero OAuth 2.0

### Frontend
- **UI Library**: React 18.2.0
- **Styling**: Tailwind CSS 3.4.1
- **Charts**: Recharts 2.13.3
- **State**: Context API + TanStack Query
- **Forms**: React Hook Form + Zod

### Backend
- **API**: Next.js API Routes
- **ORM**: Prisma 5.11.0
- **Cache**: Redis (optional)
- **Rate Limiting**: Bottleneck
- **Queue**: Built-in with Next.js

### Testing
- **E2E**: Playwright 1.52.0
- **Unit**: Vitest 1.5.0
- **Mocking**: MSW (Mock Service Worker)

## Deployment Architecture

### Recommended Production Stack
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Vercel    │────▶│  PostgreSQL  │────▶│    Redis    │
│  (Frontend) │     │   (Railway)  │     │ (Upstash)   │
└─────────────┘     └──────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│ Cloudflare  │
│    (CDN)    │
└─────────────┘
```

### Environment-Specific Configurations
- **Development**: SQLite + File Storage
- **Staging**: PostgreSQL + Redis
- **Production**: PostgreSQL + Redis + CDN

## Monitoring & Observability

### Application Monitoring
- Error tracking with Sentry
- Performance monitoring with Vercel Analytics
- Custom metrics for sync operations

### Business Metrics
- Sync success/failure rates
- API response times
- User engagement metrics
- Feature usage analytics