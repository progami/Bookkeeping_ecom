# Frontend Architecture Guide

This document outlines the frontend architecture, technologies, and principles used in this application. Follow these guidelines to maintain consistency when building features or creating similar applications in this ecosystem.

## Tech Stack

### Core Framework
- **Next.js 14.2.3** - React framework with App Router
- **React 18.2.0** - UI library
- **TypeScript 5.4.2** - Type safety and enhanced developer experience

### UI & Styling
- **Tailwind CSS 3.4.1** - Utility-first CSS framework
- **Radix UI** - Headless UI components for accessibility
- **Lucide React** - Icon library
- **Framer Motion** - Animation library
- **CVA (class-variance-authority)** - Component variant management
- **tailwind-merge** - Intelligent Tailwind class merging

### State Management
- **React Context API** - Global state management
- **Zustand 5.0.5** - Client state management (available but Context preferred)

### Form Handling
- **React Hook Form 7.51.0** - Form state management
- **Zod 3.22.4** - Schema validation
- **Custom form components** - Consistent form UI patterns

### Data Visualization
- **Recharts 2.15.3** - Chart library for analytics

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Playwright** - E2E testing
- **Winston** - Logging

## Project Structure

```
/
├── app/                    # Next.js App Router pages
│   ├── api/v1/            # API routes
│   ├── bookkeeping/       # Main bookkeeping module
│   ├── finance/           # Financial dashboard
│   ├── analytics/         # Analytics views
│   └── sync/              # Data synchronization
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── bookkeeping/      # Feature-specific components
│   └── providers.tsx     # Context providers
├── contexts/             # React contexts
├── lib/                  # Utility functions and libraries
├── hooks/                # Custom React hooks
├── types/                # TypeScript type definitions
└── public/               # Static assets
```

## Core Principles

### 1. Component Architecture

#### UI Components (`/components/ui/`)
- Use `forwardRef` for proper ref forwarding
- Mark client components with `'use client'`
- Maintain consistent prop interfaces with TypeScript
- Include loading, error, and success states
- Ensure accessibility with proper ARIA attributes

Example structure:
```typescript
'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md',
          // variant styles
          className
        )}
        disabled={loading || props.disabled}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
```

### 2. State Management

#### Context Pattern
Create contexts for feature-specific state:
```typescript
// contexts/FeatureContext.tsx
'use client';

import { createContext, useContext, ReactNode } from 'react';

interface FeatureContextValue {
  // state and methods
}

const FeatureContext = createContext<FeatureContextValue | undefined>(undefined);

export function FeatureProvider({ children }: { children: ReactNode }) {
  // implementation
  return (
    <FeatureContext.Provider value={value}>
      {children}
    </FeatureContext.Provider>
  );
}

export function useFeature() {
  const context = useContext(FeatureContext);
  if (!context) {
    throw new Error('useFeature must be used within FeatureProvider');
  }
  return context;
}
```

### 3. API Communication

Use the custom API client for all requests:
```typescript
import { apiClient } from '@/lib/api-client';

// GET request
const { data, error } = await apiClient.get('/api/v1/resource');

// POST request with automatic retries
const { data, error } = await apiClient.post('/api/v1/resource', {
  body: { key: 'value' }
});
```

### 4. Styling Guidelines

#### Tailwind CSS Usage
- Use utility classes for styling
- Create custom utilities in `tailwind.config.js` for repeated patterns
- Use CSS variables for theming (`--background`, `--foreground`, etc.)
- Leverage custom animations (`animate-shimmer`, `animate-accordion-*`)

#### Dark Theme First
The application uses a dark theme by default:
```css
:root {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... other variables */
}
```

#### Component Styling Pattern
```typescript
// Use cn() utility for conditional classes
className={cn(
  'base-classes',
  variant === 'primary' && 'variant-classes',
  size === 'lg' && 'size-classes',
  className // Allow override
)}
```

### 5. Form Handling

#### Form Component Pattern
```typescript
<form onSubmit={handleSubmit}>
  <FormInput
    label="Email"
    name="email"
    type="email"
    error={errors.email}
    required
  />
  <FormSelect
    label="Category"
    name="category"
    options={categories}
    error={errors.category}
  />
  <Button type="submit" loading={isSubmitting}>
    Submit
  </Button>
</form>
```

#### Validation with Zod
```typescript
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Invalid email'),
  category: z.string().min(1, 'Category is required')
});

type FormData = z.infer<typeof schema>;
```

### 6. Authentication & Security

#### Protected Routes
Use middleware for route protection:
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const session = request.cookies.get('user_session');
  
  if (!session && isProtectedRoute(request.pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
```

#### HOC Pattern for Feature Access
```typescript
export function withXeroConnection<P extends object>(
  Component: React.ComponentType<P>
) {
  return function ProtectedComponent(props: P) {
    const { xeroConnected } = useAuth();
    
    if (!xeroConnected) {
      return <ConnectXeroPrompt />;
    }
    
    return <Component {...props} />;
  };
}
```

### 7. Performance Optimization

#### Code Splitting
- Use dynamic imports for heavy components
- Implement route-based code splitting automatically with Next.js

#### Loading States
Always provide loading feedback:
```typescript
if (loading) {
  return <Skeleton className="h-10 w-full" />;
}
```

#### Error Boundaries
Wrap features in error boundaries:
```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
  <FeatureComponent />
</ErrorBoundary>
```

### 8. Testing Strategy

#### E2E Testing with Playwright
```typescript
test('user can complete booking workflow', async ({ page }) => {
  await page.goto('/bookkeeping');
  await page.click('[data-testid="new-booking"]');
  // ... test implementation
});
```

### 9. Logging & Debugging

#### Development Logging
```typescript
import { logger } from '@/lib/logger';

logger.info('Feature initialized', { userId, feature: 'bookkeeping' });
logger.error('API request failed', { error, endpoint });
```

Logs are written to `development.log` in development environment.

### 10. Accessibility

- Use semantic HTML elements
- Include proper ARIA labels and roles
- Ensure keyboard navigation works
- Test with screen readers
- Maintain color contrast ratios

## Best Practices

1. **Type Safety**: Always define TypeScript interfaces for props, API responses, and state
2. **Error Handling**: Handle errors gracefully with user-friendly messages
3. **Loading States**: Show appropriate loading indicators for async operations
4. **Responsive Design**: Test on mobile, tablet, and desktop viewports
5. **Performance**: Monitor bundle size and implement lazy loading where appropriate
6. **Security**: Never expose sensitive data in client-side code
7. **Consistency**: Follow established patterns for similar features
8. **Documentation**: Comment complex logic and maintain this guide

## Development Workflow

1. **Start Development Server**: `npm run dev`
2. **Run Type Checking**: `npm run type-check`
3. **Fix Linting Issues**: `npm run lint:fix`
4. **Format Code**: `npm run format`
5. **Run Tests**: `npm test`
6. **Check Logs**: `npm run logs`

## Environment Variables

Required environment variables for frontend:
- `NEXT_PUBLIC_APP_URL` - Application URL
- `NEXT_PUBLIC_XERO_CLIENT_ID` - Xero OAuth client ID
- Additional vars in `.env.local`

## Deployment Considerations

1. Run `npm run build` to verify production build
2. Ensure all environment variables are set
3. Test authentication flow in production
4. Monitor client-side errors and performance
5. Implement proper CSP headers for security

This guide should be updated as the architecture evolves to maintain accuracy and usefulness for the development team.