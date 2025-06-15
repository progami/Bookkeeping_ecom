# Bookkeeping Automation Platform

A comprehensive financial management platform built with Next.js 14, featuring real-time Xero integration, intelligent cash flow forecasting, and advanced analytics. The platform provides a complete suite of tools for modern bookkeeping with a beautiful dark theme UI.

## 🚀 Quick Start

```bash
# Clone the repository
git clone [repository-url]
cd bookkeeping

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Generate Prisma client and run migrations
npm run prisma:generate
npm run prisma:migrate

# Start the HTTPS development server
npm run dev

# Open https://localhost:3003
```

## 🏗️ Architecture Overview

### Database-First Design
The application follows a **database-first architecture** where:
- All data is synced from Xero to a local SQLite database
- No direct API calls during normal operations
- Improved performance and reduced API rate limits
- Offline capability for most features

### Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS with custom dark theme
- **Database**: SQLite with Prisma ORM
- **Authentication**: Xero OAuth2 with secure cookie storage
- **State Management**: React Context API + TanStack Query
- **Charts**: Recharts for data visualization
- **Testing**: Playwright (E2E), Vitest (Unit)

## 📦 Core Modules

### 1. 🏠 Finance Dashboard (`/finance`)
**Purpose**: Executive overview of financial health

**Features**:
- Real-time financial metrics (revenue, expenses, profit)
- Cash balance monitoring
- Financial health score (0-100)
- Quick ratio and profit margin calculations
- Module status indicators
- Direct navigation to sub-modules

**Key Components**:
- `app/finance/page.tsx` - Main dashboard
- `app/api/v1/xero/reports/*` - Financial report endpoints
- `app/api/v1/bookkeeping/cash-balance` - Cash tracking

### 2. 📚 Bookkeeping Module (`/bookkeeping`)
**Purpose**: Core accounting operations and reconciliation

**Features**:
- Bank transaction management
- Account reconciliation
- Chart of accounts management
- SOP (Standard Operating Procedures) generator
- Excel import/export functionality
- Real-time sync with Xero

**Sub-modules**:
- **Transactions** (`/bookkeeping/transactions`)
  - View and filter bank transactions
  - Reconciliation status tracking
  - Account code assignment
  - GL account mapping
  
- **Chart of Accounts** (`/bookkeeping/chart-of-accounts`)
  - Hierarchical account structure
  - Account balances
  - Tax rate configuration
  - System account management

- **SOP Generator** (`/bookkeeping/sop-generator`)
  - AI-powered procedure generation
  - Task breakdown by job function
  - Export to Excel format
  - Customizable templates

**Key APIs**:
- `app/api/v1/bookkeeping/bank-transactions` - Transaction CRUD
- `app/api/v1/xero/sync` - Full data synchronization
- `app/api/v1/bookkeeping/sops` - SOP management

### 3. 💰 Cash Flow Module (`/cashflow`)
**Purpose**: 90-day cash flow forecasting and scenario planning

**Features**:
- Interactive 90-day forecast chart
- Multiple scenario modeling:
  - Conservative (80% revenue)
  - Base case (100%)
  - Optimistic (120%)
- Tax obligation tracking (VAT, Corporation Tax, PAYE)
- Budget vs actual comparison
- Critical date alerts
- Excel budget import/export

**Advanced Features**:
- Pattern-based predictions from historical data
- Repeating transaction detection
- Seasonal adjustment factors
- Working capital optimization

**Key Components**:
- `lib/cashflow-engine.ts` - Core forecasting engine
- `lib/uk-tax-calculator.ts` - UK tax calculations
- `app/api/v1/cashflow/forecast` - Forecast API
- `app/api/v1/cashflow/budget/*` - Budget management

### 4. 📊 Analytics Module (`/analytics`)
**Purpose**: Business intelligence and vendor analytics

**Features**:
- **Spend Analysis**:
  - 30/90/365-day trend charts
  - Daily/weekly/monthly grouping
  - Growth rate calculations
  
- **Vendor Intelligence**:
  - Top 5 vendors by spend
  - Vendor growth tracking
  - Transaction frequency analysis
  - Average transaction size
  
- **Category Breakdown**:
  - Expense categorization
  - Automatic GL code mapping
  - Visual pie charts
  - Percentage of total spend

- **Export Capabilities**:
  - CSV export with full data
  - Customizable date ranges
  - Formatted reports

**Key APIs**:
- `app/api/v1/analytics/top-vendors` - Vendor rankings
- `app/api/v1/analytics/spend-trend` - Spending patterns
- `app/api/v1/analytics/category-breakdown` - Expense categories

### 5. 🗄️ Database Schema Viewer (`/database-schema`)
**Purpose**: Visual database structure exploration

**Features**:
- Interactive table browser
- Real-time data preview
- Record counts
- Table relationships
- Search functionality
- Developer-friendly interface

## 🔐 Security & Authentication

### Xero OAuth2 Integration
- Secure token storage in HTTP-only cookies
- Automatic token refresh
- Session management with 30-day expiry
- CSRF protection
- Rate limiting with Bottleneck

### Security Features
- Input validation with Zod schemas
- SQL injection prevention via Prisma
- XSS protection (React default)
- HTTPS-only in production
- Secure cookie configuration

## 📊 Data Models

### Core Entities

```prisma
// Bank Transactions
BankTransaction {
  id                String
  xeroTransactionId String   @unique
  bankAccountId     String
  date              DateTime
  amount            Float
  type              String   // SPEND or RECEIVE
  status            String
  contactName       String?  // Vendor/Customer
  accountCode       String?  // GL Account
  isReconciled      Boolean
}

// GL Accounts (Chart of Accounts)
GLAccount {
  id          String
  xeroId      String  @unique
  code        String
  name        String
  type        String
  taxType     String?
  status      String
  systemAccount String?
}

// Cash Flow Forecasts
CashFlowForecast {
  date           DateTime
  openingBalance Float
  fromInvoices   Float
  toBills        Float
  toTaxes        Float
  closingBalance Float
}
```

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Start HTTPS dev server
npm run build           # Build for production
npm run start           # Start production server

# Database
npm run prisma:studio   # Open Prisma Studio
npm run prisma:migrate # Run migrations
npm run prisma:generate # Generate Prisma client

# Testing
npm run test           # Run all tests
npm run test:unit      # Unit tests only
npm run test:e2e       # E2E tests only
npm run type-check     # TypeScript validation

# Utilities
npm run lint           # Run ESLint
npm run lint:fix       # Fix linting issues
```

### Environment Variables

```env
# Database
DATABASE_URL="file:./bookkeeping.db"

# Xero OAuth
XERO_CLIENT_ID="your_client_id"
XERO_CLIENT_SECRET="your_client_secret"

# Redis (optional, for caching)
REDIS_URL="redis://localhost:6379"

# Application
NEXT_PUBLIC_APP_URL="https://localhost:3003"
NODE_ENV="development"
```

### Testing Strategy

1. **Unit Tests** (`/tests/unit/`)
   - Business logic validation
   - API endpoint testing
   - Component testing

2. **E2E Tests** (`/tests/e2e/`)
   - Full user flows
   - Xero integration testing
   - Multi-module workflows

3. **Performance Tests**
   - Database query optimization
   - API response times
   - Frontend rendering metrics

## 🎨 UI/UX Design System

### Color Palette
- **Primary**: Emerald (#10b981) - Success, primary actions
- **Secondary**: Cyan (#06b6d4) - Info, secondary actions
- **Accent**: Indigo (#6366f1) - Special features
- **Warning**: Amber (#f59e0b) - Warnings
- **Error**: Red (#ef4444) - Errors, destructive actions
- **Background**: Slate (#0f172a) - Dark theme base

### Component Patterns
- Glassmorphism effects with backdrop blur
- Gradient overlays for hover states
- Consistent border radius (rounded-2xl)
- Subtle animations and transitions
- Responsive grid layouts

## 📈 Performance Optimizations

1. **Database**
   - Indexed queries on frequently accessed fields
   - Efficient pagination
   - Query result caching

2. **Frontend**
   - Dynamic imports for code splitting
   - Image optimization
   - Prefetching on hover
   - Optimistic UI updates

3. **API**
   - Response caching with proper headers
   - Rate limiting to prevent abuse
   - Batch operations where possible

## 🚀 Deployment

### Production Checklist
- [ ] Set production environment variables
- [ ] Configure production database (PostgreSQL recommended)
- [ ] Set up SSL certificates
- [ ] Configure Xero production app
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy

### Recommended Hosting
- **Vercel**: Optimal for Next.js applications
- **Railway**: Easy PostgreSQL deployment
- **Cloudflare**: CDN and DDoS protection

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow the existing code style
- Add tests for new features
- Update documentation
- Use conventional commits
- Run `npm run type-check` before committing

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - The React framework
- [Xero](https://www.xero.com/) - Accounting API
- [Prisma](https://www.prisma.io/) - Database ORM
- [Tailwind CSS](https://tailwindcss.com/) - Styling framework
- [Recharts](https://recharts.org/) - Chart library

---

Built with ❤️ by the Bookkeeping Team