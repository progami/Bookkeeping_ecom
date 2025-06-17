# Bookkeeping App - AI Development Guide

## 🚨 CRITICAL GUIDELINES - MUST FOLLOW

### Project Structure Rules
1. **NEVER modify the established directory structure**
   - All files must go in their designated directories
   - No files in root except config files
   - Database files stay in `/data/`
   - Documentation stays in `/docs/`

2. **File Placement Standards**
   ```
   ✅ DO:
   - API routes: /app/api/v1/[module]/[endpoint]/route.ts
   - Components: /components/[feature]/component-name.tsx
   - Utilities: /lib/[category]/utility-name.ts
   - Tests: /tests/[type]/test-name.spec.ts
   
   ❌ DON'T:
   - Place scripts in root directory
   - Create new top-level directories
   - Mix file types in same directory
   ```

3. **Import Path Rules**
   ```typescript
   // ✅ DO: Use absolute imports
   import { Button } from '@/components/ui/button'
   import { prisma } from '@/lib/prisma'
   
   // ❌ DON'T: Use relative imports across modules
   import { Button } from '../../../components/ui/button'
   ```

### Code Quality Standards

1. **TypeScript Strict Mode**
   ```typescript
   // ✅ DO: Define all types
   interface UserData {
     id: string;
     email: string;
     name?: string;
   }
   
   // ❌ DON'T: Use any type
   const processUser = (data: any) => { ... }
   ```

2. **Error Handling**
   ```typescript
   // ✅ DO: Comprehensive error handling
   try {
     const result = await operation();
     return { success: true, data: result };
   } catch (error) {
     console.error('[Module] Operation failed:', error);
     return { success: false, error: error.message };
   }
   
   // ❌ DON'T: Silent failures
   try {
     await operation();
   } catch (e) {}
   ```

3. **Database Operations**
   ```typescript
   // ✅ DO: Use transactions for related operations
   await prisma.$transaction(async (tx) => {
     await tx.user.update({ ... });
     await tx.log.create({ ... });
   });
   
   // ❌ DON'T: Multiple separate operations
   await prisma.user.update({ ... });
   await prisma.log.create({ ... });
   ```

## 🧪 TESTING REQUIREMENTS

### Before Any Response
1. **Type Check**: `npm run type-check`
2. **Lint Check**: `npm run lint`
3. **Test Modified Code**: Run relevant tests
4. **Fix All Errors**: No responses with broken code

### Browser Testing Protocol
```typescript
// 1. Navigate to page
await playwright_navigate({ url: 'https://localhost:3003/finance' });

// 2. Wait for load
await playwright_evaluate({ script: 'document.readyState' });

// 3. Take screenshot
await playwright_screenshot({ 
  name: 'feature-test',
  fullPage: true,
  savePng: true
});

// 4. Check for errors
const logs = await playwright_console_logs({ type: 'error' });
if (logs.length > 0) {
  // Fix errors before proceeding
}

// 5. Test functionality
await playwright_click({ selector: 'button[data-testid="sync"]' });
```

### Keep Browser Session Open
- **NEVER** close browser during testing sequence
- Reuse session to avoid 2FA re-authentication
- Only close when completely done

## 📁 MODULE BOUNDARIES

### Finance Module (`/finance`)
- **Owns**: Dashboard, financial metrics, health scores
- **API**: `/api/v1/xero/reports/*`
- **Components**: `/components/dashboard/*`

### Bookkeeping Module (`/bookkeeping`)
- **Owns**: Transactions, reconciliation, chart of accounts
- **API**: `/api/v1/bookkeeping/*`
- **Components**: `/components/bookkeeping/*`

### Analytics Module (`/analytics`)
- **Owns**: Vendor analysis, spending trends, reports
- **API**: `/api/v1/analytics/*`
- **Components**: `/components/analytics/*`

### Cash Flow Module (`/cashflow`)
- **Owns**: Forecasting, scenarios, budgets
- **API**: `/api/v1/cashflow/*`
- **Components**: `/components/cashflow/*`

## 🔧 DEVELOPMENT COMMANDS

### Essential Commands
```bash
# Development
npm run dev              # Start HTTPS dev server
npm run build           # Build for production
npm run type-check      # TypeScript validation
npm run lint:fix        # Fix linting issues

# Database
npm run prisma:studio   # Visual database browser
npm run prisma:migrate  # Run migrations
npm run prisma:generate # Update Prisma client

# Testing
npm test                # Run all tests
npm run test:e2e       # E2E tests only
npm run test:unit      # Unit tests only
```

### Git Workflow
```bash
# Feature branch
git checkout -b feature/module-name-description

# Commit with conventional commits
git commit -m "feat(module): add new feature"
git commit -m "fix(module): resolve issue"
git commit -m "docs(module): update documentation"
git commit -m "refactor(module): improve code structure"
git commit -m "test(module): add test coverage"
git commit -m "chore(module): update dependencies"

# Push and create PR
git push origin feature/module-name-description
```

## 🏗️ ARCHITECTURE PRINCIPLES

### 1. Database-First Design
- **ALL data comes from local database**
- Xero sync populates database
- No direct API calls in components
- Use Prisma for all queries

### 2. Component Hierarchy
```
Page Component
  └── Layout Component
      └── Feature Components
          └── UI Components
              └── Base Components
```

### 3. State Management
- **Global State**: React Context (auth, preferences)
- **Server State**: TanStack Query with caching
- **Local State**: useState for component state
- **Form State**: React Hook Form with Zod

### 4. API Design
```typescript
// Standard API response
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Standard error handling
export async function GET(request: Request) {
  try {
    // Validate session
    const session = await validateSession(request);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Process request
    const data = await getData();
    
    return NextResponse.json({ 
      success: true, 
      data 
    });
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

## 🔐 SECURITY REQUIREMENTS

### Authentication
- JWT tokens in HTTP-only cookies
- Session validation on all protected routes
- Automatic token refresh
- Secure cookie configuration

### Data Validation
```typescript
// ✅ DO: Validate all inputs
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  amount: z.number().positive(),
});

const validated = schema.parse(input);

// ❌ DON'T: Trust user input
const { email, amount } = req.body;
```

### Environment Variables
- **NEVER** commit .env files
- Use .env.example for templates
- Document all required variables
- Validate env vars on startup

## 🎨 UI/UX STANDARDS

### Design System
- **Dark Theme**: Slate backgrounds (#0f172a)
- **Primary**: Emerald (#10b981)
- **Secondary**: Cyan (#06b6d4)
- **Error**: Red (#ef4444)
- **Warning**: Amber (#f59e0b)

### Component Patterns
```tsx
// ✅ DO: Consistent component structure
export function FeatureCard({ 
  title, 
  value, 
  trend 
}: FeatureCardProps) {
  return (
    <Card className="p-6 bg-slate-800/50 backdrop-blur">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && <TrendIndicator trend={trend} />}
      </CardContent>
    </Card>
  );
}
```

### Loading States
- Skeleton screens for data loading
- Spinner for actions
- Optimistic updates where possible
- Error boundaries for failures

## 📊 PERFORMANCE GUIDELINES

### Database Queries
- Use indexes on frequently queried fields
- Implement pagination for large datasets
- Use `select` to limit returned fields
- Batch operations where possible

### Frontend Optimization
- Lazy load heavy components
- Use React.memo for expensive renders
- Implement virtual scrolling for lists
- Optimize images with Next.js Image

### API Optimization
- Implement response caching
- Use CDN for static assets
- Enable gzip compression
- Rate limit API endpoints

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] All tests passing
- [ ] TypeScript build successful
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] Security audit complete

### Post-Deployment
- [ ] Health checks passing
- [ ] Monitoring active
- [ ] Error tracking enabled
- [ ] Backup strategy verified
- [ ] Performance metrics baseline

## 🔑 CRITICAL INFORMATION

### Xero Integration
- **OAuth Flow**: PKCE-enhanced
- **Redirect URI**: `/api/v1/xero/callback`
- **Scopes**: Read-only for security
- **Rate Limits**: 60 calls/minute

### Test Credentials
```
Email: ajarrar@trademanenterprise.com
Password: gW2r4*8&wFM.#fZ
```

### Key Endpoints
- **Sync**: `POST /api/v1/xero/sync`
- **Auth**: `POST /api/v1/auth/login`
- **Health**: `GET /api/health`
- **Metrics**: `GET /api/metrics`

### Performance Targets
- Page Load: < 3s
- API Response: < 500ms
- Database Query: < 100ms
- Client-side render: < 16ms

## ⚠️ COMMON PITFALLS TO AVOID

1. **Don't make direct Xero API calls** - Use sync endpoint
2. **Don't store sensitive data in localStorage** - Use secure cookies
3. **Don't skip error boundaries** - Wrap all async operations
4. **Don't ignore TypeScript errors** - Fix them properly
5. **Don't create files in root** - Follow structure
6. **Don't use relative imports across modules** - Use aliases
7. **Don't commit without testing** - Run checks first
8. **Don't close Playwright browser during tests** - Keep session

## 📝 DOCUMENTATION REQUIREMENTS

### Code Documentation
```typescript
/**
 * Processes bank transactions for reconciliation
 * @param transactions - Array of raw transactions
 * @param accountMap - GL account mapping
 * @returns Processed transactions with account codes
 * @throws {ValidationError} If transactions are invalid
 */
export async function processTransactions(
  transactions: RawTransaction[],
  accountMap: AccountMap
): Promise<ProcessedTransaction[]> {
  // Implementation
}
```

### API Documentation
- Document all endpoints in OpenAPI format
- Include request/response examples
- Specify error codes and meanings
- Update when APIs change

### Component Documentation
- Use Storybook for UI components
- Document props with JSDoc
- Include usage examples
- Note any side effects

---

**Remember**: Always test your changes, follow the structure, and maintain code quality!