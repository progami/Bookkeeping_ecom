# Bookkeeping Automation Platform

A comprehensive financial management platform built with Next.js 14, featuring real-time Xero integration, intelligent cash flow forecasting, and advanced analytics.

## 📋 Table of Contents
- [Quick Start](#-quick-start)
- [Project Overview](#-project-overview)
- [Frontend Architecture](#-frontend-architecture)
- [Backend Architecture](#-backend-architecture)
- [Development Guidelines](#-development-guidelines)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)

## 🚀 Quick Start

```bash
# Clone the repository
git clone [repository-url]
cd bookkeeping

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env to add your Xero credentials and configure logging

# Set up the database
npm run prisma:generate
npm run prisma:migrate

# Start development server
npm run dev

# Open https://localhost:3003
```

## 🎯 Project Overview

### What is this?
A full-stack bookkeeping automation platform that integrates with Xero to provide real-time financial insights, automated reconciliation, and intelligent forecasting for UK businesses.

### Key Features
- **Real-time Xero Integration** - OAuth 2.0 + PKCE secure authentication
- **Database-First Architecture** - All data synced locally for performance
- **90-Day Cash Flow Forecasting** - AI-powered predictions with scenarios
- **Vendor Analytics** - Spending patterns and vendor intelligence
- **Automated Reconciliation** - Smart transaction matching
- **UK Tax Calculations** - VAT, Corporation Tax, PAYE support

### Tech Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM, SQLite/PostgreSQL
- **Authentication**: JWT with secure HTTP-only cookies
- **External APIs**: Xero Accounting API
- **Testing**: Playwright (E2E), Vitest (Unit)

## 🎨 Frontend Architecture

### UI/UX Design System

#### Component Structure
```
components/
├── ui/                     # Base UI components (buttons, cards, etc.)
├── layouts/                # Page layouts and navigation
├── dashboard/              # Dashboard-specific components
├── bookkeeping/            # Bookkeeping module components
├── analytics/              # Analytics visualizations
└── shared/                 # Shared/common components
```

#### Design Principles
- **Dark UI Design** - Slate background (#0f172a) with high contrast
- **Glassmorphism** - Backdrop blur effects for depth
- **Color System**:
  - Primary: Emerald (#10b981) - Success states
  - Secondary: Cyan (#06b6d4) - Information
  - Accent: Indigo (#6366f1) - Special features
  - Warning: Amber (#f59e0b)
  - Error: Red (#ef4444)

#### Key Frontend Features

1. **Finance Dashboard** (`/finance`)
   - Real-time metrics cards
   - Financial health score visualization
   - Module status indicators
   - Quick navigation grid

2. **Bookkeeping Module** (`/bookkeeping`)
   - Transaction data tables with filtering
   - Chart of Accounts tree view
   - SOP generator with Excel export
   - Reconciliation interface

3. **Cash Flow Forecasting** (`/cashflow`)
   - Interactive 90-day forecast chart
   - Scenario modeling (Conservative/Base/Optimistic)
   - Tax obligations timeline
   - Budget comparison views

4. **Analytics Dashboard** (`/analytics`)
   - Spending trend charts (Recharts)
   - Vendor ranking tables
   - Category breakdown pie charts
   - Export functionality

### State Management
- **React Context** for global state (auth, user preferences)
- **TanStack Query** for server state and caching
- **Local State** for component-specific data

### Performance Optimizations
- Dynamic imports for code splitting
- Image optimization with Next.js Image
- Prefetching on hover
- Optimistic UI updates
- Virtualized lists for large datasets

## 🔧 Backend Architecture

### API Structure

#### RESTful Endpoints
```
/api/
├── v1/
│   ├── auth/               # Authentication endpoints
│   ├── bookkeeping/        # Core bookkeeping operations
│   ├── analytics/          # Analytics and reporting
│   ├── cashflow/           # Forecasting endpoints
│   ├── xero/               # Xero integration
│   └── setup/              # User onboarding
├── health/                 # Health check endpoint
└── metrics/                # Prometheus metrics
```

#### Database Schema (Prisma)

**Core Models**:
```prisma
// User authentication
model User {
  id                String    @id @default(cuid())
  email             String    @unique
  password          String
  hasCompletedSetup Boolean   @default(false)
  // ... Xero integration fields
}

// Financial data
model BankTransaction {
  id                String    @id @default(cuid())
  xeroTransactionId String    @unique
  date              DateTime
  amount            Decimal
  type              String    // SPEND or RECEIVE
  isReconciled      Boolean
  accountCode       String?   // GL Account mapping
  // ... additional fields
}

// Chart of Accounts
model GLAccount {
  id            String    @id @default(cuid())
  code          String    @unique
  name          String
  type          String
  status        String
  // ... hierarchy fields
}
```

### Key Backend Features

1. **Authentication & Security**
   - JWT tokens with refresh mechanism
   - Secure HTTP-only cookies
   - Session validation middleware
   - Rate limiting with Bottleneck
   - Input validation with Zod schemas

2. **Xero Integration**
   - OAuth 2.0 + PKCE flow
   - Webhook support for real-time updates
   - Batch sync operations
   - Error retry with exponential backoff
   - Token refresh automation

3. **Data Processing**
   - Database-first architecture
   - Transaction reconciliation engine
   - GL account mapping
   - Currency conversion service
   - Tax calculation utilities

4. **Performance Features**
   - Redis caching (optional)
   - Database query optimization
   - Parallel processing
   - Response compression
   - Connection pooling

### Background Jobs
- Xero data synchronization
- Report generation
- Email notifications
- Data cleanup tasks

## 📐 Development Guidelines

### Logging Configuration

The application uses a concise logging system to reduce noise and improve debugging:

```bash
# Environment variables for logging control
LOG_LEVEL=info               # Global level: error, warn, info, debug
LOG_AUTH=false              # Authentication flow logs
LOG_API=false               # API request/response logs
LOG_DB=false                # Database query logs
LOG_XERO=false              # Xero API call logs
LOG_PERF=false              # Performance metrics
LOG_CACHE=false             # Cache operation logs
LOG_RATE_LIMIT=false        # Rate limiting logs
```

**Key Features:**
- Emoji indicators: ❌ (error), ⚠️ (warning), ✅ (success), ℹ️ (info)
- Automatic filtering of fast successful requests
- Context-aware logging with feature flags
- Production-ready with minimal noise

### Code Standards

#### TypeScript
```typescript
// ✅ DO: Use proper types
interface TransactionData {
  id: string;
  amount: Decimal;
  date: Date;
}

// ❌ DON'T: Use any
const processData = (data: any) => { ... }

// ✅ DO: Use enums for constants
enum TransactionType {
  SPEND = 'SPEND',
  RECEIVE = 'RECEIVE'
}
```

#### React Components
```tsx
// ✅ DO: Functional components with proper typing
interface DashboardCardProps {
  title: string;
  value: number;
  trend?: 'up' | 'down';
}

export function DashboardCard({ title, value, trend }: DashboardCardProps) {
  return (
    <Card className="p-6">
      {/* Component content */}
    </Card>
  );
}

// ❌ DON'T: Class components or untyped props
```

#### API Routes
```typescript
// ✅ DO: Validate inputs and handle errors
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = schema.parse(body);
    
    // Process request
    
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    // Handle other errors
  }
}
```

### Testing Requirements

1. **Unit Tests** - Business logic and utilities
2. **Integration Tests** - API endpoints
3. **E2E Tests** - Critical user flows
4. **Performance Tests** - Load testing for APIs

### Git Workflow

```bash
# Feature development
git checkout -b feature/description
git commit -m "feat: add new feature"

# Bug fixes
git checkout -b fix/description
git commit -m "fix: resolve issue"

# Documentation
git commit -m "docs: update README"
```

## 📁 Project Structure

```
bookkeeping/
├── .github/                # GitHub templates and workflows
├── app/                    # Next.js app directory
│   ├── (auth)/            # Auth pages (login, register)
│   ├── (dashboard)/       # Main app pages
│   ├── api/               # API routes
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # Base UI components
│   └── [feature]/        # Feature-specific components
├── contexts/             # React contexts
├── data/                 # Database files (gitignored)
├── docs/                 # Documentation
│   ├── api/             # API documentation
│   ├── development/     # Dev guides
│   └── guides/          # User guides
├── lib/                  # Utilities and services
│   ├── auth/            # Authentication utilities
│   ├── xero/            # Xero integration
│   └── utils/           # General utilities
├── prisma/              # Database schema and migrations
├── public/              # Static assets
├── scripts/             # Utility scripts
│   └── maintenance/     # DB maintenance scripts
├── tests/               # Test suites
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   └── e2e/            # End-to-end tests
└── types/               # TypeScript type definitions
```

### Important Files
- `middleware.ts` - Next.js middleware for auth
- `CLAUDE.md` - AI assistant guidelines
- `.env.example` - Environment variable template
- `prisma/schema.prisma` - Database schema

## 🚀 Deployment

### Environment Variables
```env
# Database
DATABASE_URL="postgresql://..."  # Production DB

# Xero OAuth
XERO_CLIENT_ID="..."
XERO_CLIENT_SECRET="..."
XERO_WEBHOOK_KEY="..."

# Security
JWT_SECRET="..."
NEXTAUTH_SECRET="..."

# Application
NEXT_PUBLIC_APP_URL="https://app.domain.com"
NODE_ENV="production"

# Optional Services
REDIS_URL="redis://..."
SENTRY_DSN="..."
```

### Production Checklist
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] SSL certificates installed
- [ ] Monitoring configured
- [ ] Backup strategy implemented
- [ ] Rate limiting configured
- [ ] Error tracking enabled

## 🤝 Contributing

Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting PRs.

### Quick Links
- [API Documentation](docs/api/API_DOCUMENTATION.md)
- [Frontend Guide](docs/guides/FRONTEND_QUICK_REFERENCE.md)
- [Development Guide](docs/development/CLAUDE.md)
- [Security Policy](SECURITY.md)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ by the Bookkeeping Team