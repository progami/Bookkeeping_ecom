# Finance Module Frontend Guidelines

## Version 1.0 - December 2024

This document establishes comprehensive frontend development standards for all applications within the finance module. These guidelines ensure consistency, accessibility, performance, and maintainability across our financial applications.

## Table of Contents

1. [Design System Standards](#1-design-system-standards)
2. [Architecture Principles](#2-architecture-principles)
3. [UI/UX Best Practices](#3-uiux-best-practices)
4. [Code Standards](#4-code-standards)
5. [Cross-App Consistency](#5-cross-app-consistency)
6. [Accessibility Requirements](#6-accessibility-requirements)
7. [Performance Guidelines](#7-performance-guidelines)
8. [Testing Requirements](#8-testing-requirements)

---

## 1. Design System Standards

### 1.1 Design Tokens

All design decisions must be tokenized and stored in a centralized system. These tokens are the single source of truth for all UI properties.

#### Color System

```typescript
// Core color palette with WCAG AA compliance (4.5:1 contrast ratio)
const colors = {
  // Background colors
  background: {
    primary: '#0a0a0b',    // Main app background
    secondary: '#1a1a1c',  // Card backgrounds
    tertiary: '#2a2a2d',   // Nested elements
    elevated: '#35353a',   // Modals, dropdowns
  },
  
  // Text colors
  text: {
    primary: '#ffffff',    // Primary text
    secondary: '#e2e8f0',  // Secondary text
    tertiary: '#94a3b8',   // Muted text
    muted: '#64748b',      // Disabled/helper text
  },
  
  // Brand colors
  brand: {
    emerald: {
      DEFAULT: '#10b981',
      light: '#34d399',
      dark: '#059669',
      bg: 'rgba(16, 185, 129, 0.1)',
      border: 'rgba(16, 185, 129, 0.2)',
    },
    // Similar structure for blue, purple, amber, red
  },
  
  // Status colors (must meet WCAG contrast requirements)
  status: {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  }
}
```

#### Typography Scale

Use a 1.25 ratio (Major Third) for consistent type scaling:

```typescript
const typography = {
  fontSize: {
    xs: '0.75rem',      // 12px
    sm: '0.875rem',     // 14px
    base: '1rem',       // 16px
    lg: '1.125rem',     // 18px
    xl: '1.25rem',      // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '1.875rem',  // 30px
    '4xl': '2.25rem',   // 36px
    '5xl': '3rem',      // 48px
  },
  
  // Responsive typography
  responsive: {
    h1: 'text-2xl sm:text-3xl lg:text-4xl',
    h2: 'text-xl sm:text-2xl lg:text-3xl',
    h3: 'text-lg sm:text-xl lg:text-2xl',
    body: 'text-sm sm:text-base',
  }
}
```

#### Spacing System (8pt Grid)

```typescript
const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
}
```

### 1.2 Component Library Standards

#### Required Base Components

Every finance module app must implement these standardized components:

1. **Button**
   - Variants: primary, secondary, success, danger, warning, ghost
   - Sizes: sm (32px), md (40px), lg (48px)
   - States: default, hover, active, disabled, loading
   - Touch target: minimum 44x44px
   - Must include ripple effect animation
   - Loading state with spinner

2. **Card**
   - Base card with consistent styling
   - MetricCard for KPIs
   - ModuleCard for navigation
   - Border: `border-slate-800`
   - Border radius: `rounded-2xl`
   - Shadow: `shadow-xl`

3. **DataTable**
   - Sortable columns
   - Row selection with checkboxes
   - Bulk actions
   - Pagination
   - Responsive design (horizontal scroll on mobile)
   - Export functionality
   - Search/filter capabilities

4. **Form Controls**
   - Input fields with floating labels
   - Error states with messages
   - Helper text support
   - Touch-friendly sizing (min 44px height)
   - Currency/number formatting
   - Date pickers with calendar

5. **Navigation**
   - Sidebar with collapsible state
   - Mobile hamburger menu
   - Breadcrumbs
   - Tab navigation

6. **Feedback Components**
   - Toast notifications (using react-hot-toast)
   - Loading skeletons
   - Progress indicators
   - Empty states with illustrations
   - Error boundaries

### 1.3 Theme Requirements

- Support light and dark themes
- System theme detection
- Theme persistence in localStorage
- Smooth transitions between themes
- All components must work in both themes

---

## 2. Architecture Principles

### 2.1 Folder Structure

Adopt a feature-based architecture:

```
src/
├── features/
│   ├── transactions/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── index.ts
│   ├── accounts/
│   └── reports/
├── shared/
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   └── types/
├── lib/
│   ├── api/
│   ├── auth/
│   └── config/
└── app/ (Next.js app directory)
```

### 2.2 State Management Strategy

#### State Types and Tools

1. **Local Component State**
   - Use: `useState`, `useReducer`
   - For: UI state, form state, temporary values

2. **Global Client State**
   - Use: Zustand or Context API
   - For: User preferences, auth status, app-wide UI state
   
3. **Server Cache State**
   - Use: TanStack Query (React Query) or SWR
   - For: API data, cached responses, background refetch
   
4. **URL State**
   - Use: Next.js router, query params
   - For: Filters, pagination, active tabs

#### Example Server State Implementation

```typescript
// Using TanStack Query for financial data
export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => fetchTransactions(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    retry: 3,
  })
}
```

### 2.3 API Layer Architecture

```typescript
// Centralized API client
class FinanceAPI {
  private client: AxiosInstance
  
  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL,
      timeout: 30000,
    })
    
    // Request interceptor for auth
    this.client.interceptors.request.use(
      (config) => {
        const token = getAuthToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      }
    )
    
    // Response interceptor for errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle auth refresh
        }
        return Promise.reject(error)
      }
    )
  }
}
```

### 2.4 Error Handling Strategy

```typescript
// Global error boundary
export class ErrorBoundary extends Component<Props, State> {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to monitoring service
    captureException(error, { extra: errorInfo })
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReset={this.resetError} />
    }
    return this.props.children
  }
}

// API error handling
export async function apiCall<T>(
  fn: () => Promise<T>
): Promise<{ data?: T; error?: ApiError }> {
  try {
    const data = await fn()
    return { data }
  } catch (error) {
    const apiError = parseApiError(error)
    toast.error(apiError.message)
    return { error: apiError }
  }
}
```

---

## 3. UI/UX Best Practices

### 3.1 Financial Data Display

#### Number Formatting

```typescript
// Currency formatting
export function formatCurrency(
  amount: number,
  currency = 'USD',
  locale = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Percentage formatting
export function formatPercentage(
  value: number,
  decimals = 2
): string {
  return `${(value * 100).toFixed(decimals)}%`
}
```

#### Data Tables

- Always include sorting indicators
- Highlight negative values in red
- Right-align numeric columns
- Include totals/summaries where applicable
- Support CSV/Excel export
- Implement virtualization for large datasets

### 3.2 Loading & Feedback States

#### Loading Patterns

```typescript
// Skeleton loader example
export function TransactionSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="h-4 bg-slate-800 rounded w-3/4 mb-2" />
          <div className="h-3 bg-slate-800 rounded w-1/2" />
        </div>
      ))}
    </div>
  )
}
```

#### User Feedback

```typescript
// Standardized notifications
export const notify = {
  success: (message: string) => toast.success(message, {
    duration: 4000,
    style: { background: '#10b981', color: '#fff' }
  }),
  
  error: (message: string) => toast.error(message, {
    duration: 6000,
    style: { background: '#ef4444', color: '#fff' }
  }),
  
  loading: (message: string) => toast.loading(message, {
    style: { background: '#3b82f6', color: '#fff' }
  })
}
```

### 3.3 Responsive Design

#### Breakpoints

```typescript
const breakpoints = {
  sm: '640px',   // Mobile landscape
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
  '2xl': '1536px' // Extra large
}
```

#### Mobile Patterns

- Stack cards vertically on mobile
- Use bottom sheets for modals
- Implement swipe gestures for navigation
- Ensure all touch targets are 44x44px minimum
- Use sticky headers for long scrolling content

### 3.4 Empty States

```typescript
export function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Icon className="w-16 h-16 text-muted mb-4" />
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted text-center max-w-md mb-6">
        {description}
      </p>
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
```

---

## 4. Code Standards

### 4.1 TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### 4.2 Component Patterns

#### Type-Safe Component Props

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ComponentType<{ className?: string }>
  iconPosition?: 'left' | 'right'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, ...props }, ref) => {
    // Implementation
  }
)

Button.displayName = 'Button'
```

### 4.3 Tailwind CSS Best Practices

#### DO:
```tsx
// ✅ Compose utilities directly
<button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg">
  Click me
</button>

// ✅ Use design tokens via Tailwind config
<div className="bg-background-primary text-text-primary">
  Content
</div>

// ✅ Extract repeated patterns into components
export function Card({ children, className }: CardProps) {
  return (
    <div className={cn(
      "bg-background-secondary rounded-2xl border border-slate-800 p-6",
      className
    )}>
      {children}
    </div>
  )
}
```

#### DON'T:
```tsx
// ❌ Avoid @apply in CSS files
.button {
  @apply px-4 py-2 bg-blue-500; /* Creates unnecessary CSS */
}

// ❌ Don't use arbitrary values when tokens exist
<div className="p-[17px]"> /* Use p-4 instead */

// ❌ Don't mix styling approaches
<div className="card" style={{ padding: '16px' }}>
```

### 4.4 Performance Optimization

#### Code Splitting

```typescript
// Lazy load heavy components
const ChartComponent = lazy(() => import('@/components/charts/ChartComponent'))

// Route-based splitting
const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage'))
```

#### Memoization

```typescript
// Memoize expensive calculations
const totalRevenue = useMemo(() => {
  return transactions.reduce((sum, tx) => sum + tx.amount, 0)
}, [transactions])

// Memoize components to prevent re-renders
const TransactionRow = memo(({ transaction }: Props) => {
  // Component implementation
})
```

---

## 5. Cross-App Consistency

### 5.1 Shared Authentication

```typescript
// Centralized auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

// Protected route component
export function ProtectedRoute({ children, requiredRole }: Props) {
  const { user, isLoading } = useAuth()
  
  if (isLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" />
  if (requiredRole && !user.roles.includes(requiredRole)) {
    return <UnauthorizedScreen />
  }
  
  return children
}
```

### 5.2 Navigation Standards

#### Sidebar Navigation Structure

```typescript
const navigationItems = [
  {
    title: 'Module Name',
    href: '/module-path',
    icon: IconComponent,
    description: 'Brief description',
    badge?: 'New' | number,
  }
]
```

#### URL Structure

- `/finance/dashboard` - Module dashboards
- `/finance/transactions` - List views
- `/finance/transactions/:id` - Detail views
- `/finance/reports/profit-loss` - Nested features

### 5.3 Shared Utilities

```typescript
// Date formatting
export const dateFormat = {
  short: 'MMM d, yyyy',
  long: 'MMMM d, yyyy h:mm a',
  iso: 'yyyy-MM-dd',
  relative: (date: Date) => formatDistanceToNow(date, { addSuffix: true })
}

// API response types
export interface ApiResponse<T> {
  data: T
  meta?: {
    page: number
    total: number
    pageSize: number
  }
  error?: {
    code: string
    message: string
    details?: Record<string, string[]>
  }
}
```

---

## 6. Accessibility Requirements

### 6.1 WCAG 2.2 Level AA Compliance

All finance module applications must meet WCAG 2.2 Level AA standards.

#### Key Requirements for Financial Apps

1. **Focus Management**
   - Focus indicators must be at least 2px solid outline
   - Focus must not be obscured by other content
   - Logical tab order through all interactive elements

2. **Form Accessibility**
   - All inputs must have associated labels
   - Error messages must be programmatically associated
   - Required fields clearly marked
   - Instructions provided for complex inputs
   - No cognitive function tests for authentication

3. **Data Tables**
   ```html
   <table>
     <caption>Transaction History for October 2024</caption>
     <thead>
       <tr>
         <th scope="col">Date</th>
         <th scope="col">Description</th>
         <th scope="col" class="text-right">Amount</th>
       </tr>
     </thead>
   </table>
   ```

4. **Color & Contrast**
   - Text: 4.5:1 contrast ratio (normal text)
   - Large text: 3:1 contrast ratio
   - Interactive elements: 3:1 contrast ratio
   - Don't rely on color alone for meaning

5. **Keyboard Navigation**
   - All functionality keyboard accessible
   - Skip links for main content
   - Escape key closes modals
   - Arrow keys for menu navigation

### 6.2 Screen Reader Support

```typescript
// Announce dynamic content changes
export function LiveRegion({ message, priority = 'polite' }: Props) {
  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  )
}

// Provide context for complex interactions
<button
  aria-label="Delete transaction from May 15, 2024 for $150.00"
  aria-describedby="delete-warning"
>
  <TrashIcon />
</button>
```

### 6.3 Financial Data Accessibility

```typescript
// Make financial data understandable
export function AccessibleCurrency({ amount, currency = 'USD' }: Props) {
  const formatted = formatCurrency(amount, currency)
  const readable = amount < 0 ? 'negative' : 'positive'
  
  return (
    <span aria-label={`${readable} ${formatted}`}>
      {formatted}
    </span>
  )
}
```

---

## 7. Performance Guidelines

### 7.1 Core Web Vitals Targets

- **LCP (Largest Contentful Paint)**: < 2.5s
- **FID (First Input Delay)**: < 100ms
- **CLS (Cumulative Layout Shift)**: < 0.1
- **INP (Interaction to Next Paint)**: < 200ms

### 7.2 Bundle Size Optimization

```javascript
// Next.js config for optimization
module.exports = {
  experimental: {
    optimizePackageImports: ['@tremor/react', 'lucide-react'],
  },
  
  webpack: (config) => {
    config.optimization.splitChunks = {
      chunks: 'all',
      cacheGroups: {
        default: false,
        vendors: false,
        vendor: {
          name: 'vendor',
          chunks: 'all',
          test: /node_modules/,
        },
      },
    }
    return config
  },
}
```

### 7.3 Data Fetching Optimization

```typescript
// Parallel data fetching
export async function getDashboardData() {
  const [accounts, transactions, reports] = await Promise.all([
    fetchAccounts(),
    fetchRecentTransactions(),
    fetchMonthlyReports(),
  ])
  
  return { accounts, transactions, reports }
}

// Pagination for large datasets
export function usePaginatedData<T>(
  endpoint: string,
  pageSize = 50
) {
  const [page, setPage] = useState(1)
  
  const { data, isLoading } = useQuery({
    queryKey: [endpoint, page, pageSize],
    queryFn: () => fetchPaginated(endpoint, page, pageSize),
    keepPreviousData: true,
  })
  
  return { data, isLoading, page, setPage }
}
```

---

## 8. Testing Requirements

### 8.1 Testing Pyramid

1. **Unit Tests (70%)**
   - Pure functions
   - Utility modules
   - Custom hooks
   - Reducers/state logic

2. **Integration Tests (20%)**
   - Component interactions
   - API integration
   - State management flows

3. **E2E Tests (10%)**
   - Critical user flows
   - Payment processes
   - Report generation

### 8.2 Component Testing

```typescript
// Example component test
describe('TransactionForm', () => {
  it('validates required fields', async () => {
    render(<TransactionForm onSubmit={jest.fn()} />)
    
    const submitButton = screen.getByRole('button', { name: /submit/i })
    await userEvent.click(submitButton)
    
    expect(screen.getByText(/amount is required/i)).toBeInTheDocument()
    expect(screen.getByText(/date is required/i)).toBeInTheDocument()
  })
  
  it('formats currency input correctly', async () => {
    render(<TransactionForm onSubmit={jest.fn()} />)
    
    const amountInput = screen.getByLabelText(/amount/i)
    await userEvent.type(amountInput, '1234.56')
    
    expect(amountInput).toHaveValue('$1,234.56')
  })
})
```

### 8.3 Accessibility Testing

```typescript
// Automated accessibility checks
describe('Accessibility', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<DashboardPage />)
    const results = await axe(container)
    
    expect(results).toHaveNoViolations()
  })
  
  it('supports keyboard navigation', async () => {
    render(<Navigation />)
    
    const firstLink = screen.getByRole('link', { name: /dashboard/i })
    firstLink.focus()
    
    await userEvent.keyboard('{ArrowDown}')
    
    const secondLink = screen.getByRole('link', { name: /transactions/i })
    expect(secondLink).toHaveFocus()
  })
})
```

### 8.4 Performance Testing

```typescript
// Performance monitoring in tests
it('renders large dataset efficiently', async () => {
  const startTime = performance.now()
  
  render(<TransactionTable transactions={largeDataset} />)
  
  const renderTime = performance.now() - startTime
  expect(renderTime).toBeLessThan(100) // 100ms threshold
  
  // Check for virtualization
  const visibleRows = screen.getAllByRole('row')
  expect(visibleRows).toHaveLength(50) // Only 50 visible at a time
})
```

---

## Implementation Checklist

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up design token system
- [ ] Configure TypeScript with strict mode
- [ ] Implement core components (Button, Card, Input)
- [ ] Set up Tailwind with custom theme
- [ ] Configure ESLint and Prettier

### Phase 2: Architecture (Weeks 3-4)
- [ ] Implement feature-based folder structure
- [ ] Set up state management (TanStack Query + Zustand)
- [ ] Create API client with interceptors
- [ ] Implement error boundaries
- [ ] Set up authentication flow

### Phase 3: Components (Weeks 5-6)
- [ ] Build data table component
- [ ] Create form components with validation
- [ ] Implement navigation components
- [ ] Add loading states and skeletons
- [ ] Create feedback components

### Phase 4: Accessibility (Week 7)
- [ ] Audit color contrast
- [ ] Implement keyboard navigation
- [ ] Add ARIA labels and roles
- [ ] Test with screen readers
- [ ] Run automated accessibility tests

### Phase 5: Testing & Documentation (Week 8)
- [ ] Write unit tests for utilities
- [ ] Add component tests
- [ ] Create E2E test suite
- [ ] Document component usage
- [ ] Create Storybook stories

---

## Conclusion

These guidelines provide a comprehensive framework for building consistent, accessible, and performant financial applications. Regular reviews and updates will ensure they remain relevant as the module evolves.

For questions or clarifications, contact the Frontend Architecture team.