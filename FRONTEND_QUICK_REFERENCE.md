# Frontend Quick Reference Guide

## Common Patterns & Code Snippets

### 🎨 Color Usage

```tsx
// ✅ Correct - Using design tokens
<div className="bg-background-primary text-text-primary">
<div className="border-slate-800 bg-background-secondary">
<button className="bg-emerald-600 hover:bg-emerald-700">

// ❌ Incorrect - Hardcoded colors
<div className="bg-gray-900 text-white">
<div className="bg-[#1a1a1c]">
```

### 📱 Responsive Patterns

```tsx
// Text sizing
<h1 className="text-2xl sm:text-3xl lg:text-4xl">
<p className="text-sm sm:text-base">

// Padding
<div className="p-4 sm:p-6 lg:p-8">

// Grid layouts
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
```

### 🔘 Button Component

```tsx
import { Button } from '@/components/ui/button'

// Primary action
<Button variant="primary" size="md">
  Save Changes
</Button>

// With loading state
<Button variant="primary" loading={isLoading}>
  {isLoading ? 'Processing...' : 'Submit'}
</Button>

// With icon
<Button variant="secondary" icon={PlusIcon}>
  Add Transaction
</Button>

// Danger action
<Button variant="danger" onClick={handleDelete}>
  Delete
</Button>
```

### 💳 Card Components

```tsx
// Basic card
<Card>
  <CardHeader>
    <CardTitle>Revenue</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-2xl font-bold">$45,231.89</p>
  </CardContent>
</Card>

// Metric card
<MetricCard
  title="Total Revenue"
  value={45231.89}
  change={12.5}
  trend="up"
  icon={TrendingUpIcon}
/>

// Module card (for navigation)
<ModuleCard
  title="Bookkeeping"
  description="Manage transactions"
  href="/bookkeeping"
  icon={BookOpenIcon}
  stats={[
    { label: 'Pending', value: 23 },
    { label: 'Completed', value: 156 }
  ]}
/>
```

### 📊 Data Tables

```tsx
<DataTable
  columns={[
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      cell: (row) => formatDate(row.date, 'short')
    },
    {
      key: 'description',
      header: 'Description',
      cell: (row) => (
        <span className="truncate max-w-xs">{row.description}</span>
      )
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sortable: true,
      cell: (row) => (
        <span className={row.amount < 0 ? 'text-red-500' : ''}>
          {formatCurrency(row.amount)}
        </span>
      )
    }
  ]}
  data={transactions}
  onSort={handleSort}
  onSelect={handleSelect}
  bulkActions={[
    { label: 'Export', action: handleExport },
    { label: 'Delete', action: handleBulkDelete, variant: 'danger' }
  ]}
/>
```

### 📝 Form Patterns

```tsx
// Text input
<div className="space-y-2">
  <label htmlFor="amount" className="text-sm font-medium">
    Amount
  </label>
  <input
    id="amount"
    type="text"
    value={formatCurrency(amount)}
    onChange={(e) => setAmount(parseCurrency(e.target.value))}
    className="w-full px-3 py-2 bg-background-secondary border border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
    aria-describedby="amount-error"
  />
  {errors.amount && (
    <p id="amount-error" className="text-sm text-red-500">
      {errors.amount}
    </p>
  )}
</div>

// Select dropdown
<select
  value={category}
  onChange={(e) => setCategory(e.target.value)}
  className="w-full px-3 py-2 bg-background-secondary border border-slate-800 rounded-lg"
>
  <option value="">Select category</option>
  {categories.map(cat => (
    <option key={cat.id} value={cat.id}>{cat.name}</option>
  ))}
</select>

// Checkbox
<label className="flex items-center space-x-3 cursor-pointer">
  <input
    type="checkbox"
    checked={isRecurring}
    onChange={(e) => setIsRecurring(e.target.checked)}
    className="w-5 h-5 rounded border-slate-800 text-emerald-600 focus:ring-emerald-500"
  />
  <span className="text-sm">Recurring transaction</span>
</label>
```

### 🔄 Loading States

```tsx
// Skeleton loader
export function TransactionSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-24 bg-slate-800 rounded" />
            <div className="flex-1 h-10 bg-slate-800 rounded" />
            <div className="h-10 w-32 bg-slate-800 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Loading spinner
<div className="flex items-center justify-center p-8">
  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
</div>

// Button loading state
<Button loading={isLoading}>
  {isLoading ? 'Processing...' : 'Submit'}
</Button>
```

### 🚨 Notifications

```tsx
import { toast } from 'react-hot-toast'

// Success
toast.success('Transaction saved successfully')

// Error
toast.error('Failed to process payment. Please try again.')

// Loading
const toastId = toast.loading('Processing transaction...')
// Later...
toast.success('Transaction completed!', { id: toastId })

// Custom notification
toast.custom((t) => (
  <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} bg-background-secondary border border-slate-800 rounded-lg p-4`}>
    <p className="font-medium">New transaction received</p>
    <p className="text-sm text-text-secondary">Amount: $1,234.56</p>
  </div>
))
```

### 🗂️ Empty States

```tsx
<EmptyState
  icon={InboxIcon}
  title="No transactions found"
  description="Start by adding your first transaction or importing from your bank."
  action={{
    label: 'Add Transaction',
    onClick: () => router.push('/transactions/new')
  }}
/>
```

### 💰 Financial Formatting

```tsx
// Currency
formatCurrency(1234.56) // $1,234.56
formatCurrency(-500) // -$500.00
formatCurrency(0) // $0.00

// Percentages
formatPercentage(0.125) // 12.50%
formatPercentage(-0.05) // -5.00%

// Large numbers
formatCompactNumber(1234567) // 1.2M
formatCompactNumber(1234) // 1.2K

// Dates
formatDate(new Date(), 'short') // Oct 15, 2024
formatDate(new Date(), 'long') // October 15, 2024 3:45 PM
formatRelativeDate(date) // 2 hours ago
```

### 🎯 Accessibility Patterns

```tsx
// Skip link
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-emerald-600 text-white px-4 py-2 rounded">
  Skip to main content
</a>

// Screen reader only text
<span className="sr-only">Loading financial data</span>

// Accessible form
<form onSubmit={handleSubmit}>
  <fieldset>
    <legend className="text-lg font-semibold mb-4">
      Transaction Details
    </legend>
    
    <div className="space-y-4">
      <div>
        <label htmlFor="amount" className="block text-sm font-medium mb-1">
          Amount <span className="text-red-500">*</span>
        </label>
        <input
          id="amount"
          type="text"
          required
          aria-required="true"
          aria-invalid={!!errors.amount}
          aria-describedby={errors.amount ? 'amount-error' : 'amount-hint'}
        />
        <p id="amount-hint" className="text-xs text-text-muted mt-1">
          Enter the transaction amount
        </p>
        {errors.amount && (
          <p id="amount-error" role="alert" className="text-sm text-red-500 mt-1">
            {errors.amount}
          </p>
        )}
      </div>
    </div>
  </fieldset>
</form>

// Accessible data table
<table role="table" aria-label="Transaction history">
  <thead>
    <tr role="row">
      <th role="columnheader" scope="col">Date</th>
      <th role="columnheader" scope="col">Description</th>
      <th role="columnheader" scope="col" className="text-right">Amount</th>
    </tr>
  </thead>
  <tbody>
    {transactions.map(tx => (
      <tr key={tx.id} role="row">
        <td role="cell">{formatDate(tx.date)}</td>
        <td role="cell">{tx.description}</td>
        <td role="cell" className="text-right">
          <span className={tx.amount < 0 ? 'text-red-500' : ''}>
            {formatCurrency(tx.amount)}
          </span>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

### 🔍 Search Pattern

```tsx
export function SearchInput({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState('')
  
  const debouncedSearch = useMemo(
    () => debounce((value: string) => onSearch(value), 300),
    [onSearch]
  )
  
  return (
    <div className="relative">
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          debouncedSearch(e.target.value)
        }}
        placeholder="Search transactions..."
        className="w-full pl-10 pr-4 py-2 bg-background-secondary border border-slate-800 rounded-lg"
        aria-label="Search transactions"
      />
    </div>
  )
}
```

### 🎨 Theme Toggle

```tsx
<ThemeToggle />

// Or custom implementation
export function ThemeSelector() {
  const { theme, setTheme } = useTheme()
  
  return (
    <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-lg">
      <button
        onClick={() => setTheme('light')}
        className={cn(
          "p-2 rounded-md transition-all",
          theme === 'light' 
            ? "bg-slate-700 text-white" 
            : "text-gray-400 hover:text-white"
        )}
        aria-label="Light theme"
      >
        <SunIcon className="w-4 h-4" />
      </button>
      
      <button
        onClick={() => setTheme('dark')}
        className={cn(
          "p-2 rounded-md transition-all",
          theme === 'dark' 
            ? "bg-slate-700 text-white" 
            : "text-gray-400 hover:text-white"
        )}
        aria-label="Dark theme"
      >
        <MoonIcon className="w-4 h-4" />
      </button>
    </div>
  )
}
```

### 📱 Mobile Menu

```tsx
export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false)
  
  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-slate-800/95 backdrop-blur-sm rounded-xl"
        aria-label="Toggle menu"
      >
        {isOpen ? <XIcon /> : <MenuIcon />}
      </button>
      
      {isOpen && (
        <>
          <div 
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsOpen(false)}
          />
          <nav className="lg:hidden fixed left-0 top-0 h-full w-64 bg-background-primary z-45">
            {/* Navigation items */}
          </nav>
        </>
      )}
    </>
  )
}
```

---

## Quick Debugging Tips

### Console Helpers

```typescript
// Theme debugging
console.log('[Theme]', {
  current: localStorage.getItem('theme'),
  htmlClasses: document.documentElement.className,
  computed: window.getComputedStyle(document.body).backgroundColor
})

// Performance debugging
console.time('Component render')
// ... component code
console.timeEnd('Component render')

// API debugging
window.DEBUG_API = true // Enable in console
if (window.DEBUG_API) {
  console.log('[API]', method, url, data)
}
```

### Common Issues & Fixes

1. **Theme not applying**
   - Check if ThemeProvider wraps the app
   - Verify localStorage has theme value
   - Check for conflicting CSS

2. **Responsive layout broken**
   - Use responsive viewer in DevTools
   - Check for hardcoded widths
   - Verify breakpoint values

3. **Touch targets too small**
   - Minimum 44x44px for mobile
   - Add padding, not just size
   - Test on actual device

4. **Form validation not showing**
   - Check aria-describedby links
   - Verify error state management
   - Test with screen reader