'use client'

import { Fragment } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[]
  className?: string
}

// Default route label mappings
const routeLabels: Record<string, string> = {
  'finance': 'Finance Overview',
  'bookkeeping': 'Bookkeeping',
  'transactions': 'Transactions',
  'chart-of-accounts': 'Chart of Accounts',
  'analytics': 'Analytics',
  'sop-tables': 'SOP Tables',
  'sop-generator': 'SOP Generator',
  'cashflow': 'Cash Flow',
  'database-schema': 'Database Schema',
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const pathname = usePathname()
  
  // Generate breadcrumbs from pathname if items not provided
  const breadcrumbItems = items || (() => {
    const segments = pathname.split('/').filter(Boolean)
    const generatedItems: BreadcrumbItem[] = [
      { label: 'Finance', href: '/finance' }
    ]
    
    let currentPath = ''
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`
      const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
      
      generatedItems.push({
        label,
        href: index === segments.length - 1 ? undefined : currentPath
      })
    })
    
    return generatedItems
  })()
  
  if (breadcrumbItems.length <= 1) {
    return null
  }
  
  return (
    <nav 
      aria-label="Breadcrumb" 
      className={cn("mb-4", className)}
    >
      <ol className="flex items-center space-x-2 text-sm">
        {breadcrumbItems.map((item, index) => (
          <Fragment key={index}>
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
            )}
            <li className="flex items-center">
              {item.href ? (
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1 text-gray-400 hover:text-white transition-colors",
                    "hover:underline underline-offset-4"
                  )}
                >
                  {index === 0 && <Home className="h-3.5 w-3.5" />}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span className="flex items-center gap-1 text-white font-medium">
                  {index === 0 && <Home className="h-3.5 w-3.5" />}
                  {item.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}