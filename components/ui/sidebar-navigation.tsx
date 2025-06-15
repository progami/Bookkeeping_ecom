'use client'

import { usePathname, useRouter } from 'next/navigation'
import { 
  Home, BookOpen, LineChart, BarChart3,
  ChevronLeft, ChevronRight, Menu, X
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/components/layouts/app-layout'

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  description: string
  badge?: string | number
}

const navigation: NavItem[] = [
  {
    title: 'Finance Overview',
    href: '/finance',
    icon: Home,
    description: 'Financial dashboard & metrics'
  },
  {
    title: 'Bookkeeping',
    href: '/bookkeeping',
    icon: BookOpen,
    description: 'Transactions & reconciliation'
  },
  {
    title: 'Cash Flow',
    href: '/cashflow',
    icon: LineChart,
    description: '90-day forecasting'
  },
  {
    title: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    description: 'Business intelligence'
  }
]

export function SidebarNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { isCollapsed, setIsCollapsed } = useSidebar()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  const toggleCollapsed = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem('sidebar-collapsed', newState.toString())
  }

  const isActive = (href: string) => {
    if (href === '/finance' && pathname === '/') return true
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-slate-800 border border-slate-700 rounded-xl shadow-lg"
        aria-label="Toggle navigation menu"
      >
        {isMobileOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <Menu className="h-6 w-6 text-white" />
        )}
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen bg-slate-900 border-r border-slate-800 transition-all duration-300",
          isCollapsed ? "w-20" : "w-64",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-slate-800">
            {!isCollapsed && (
              <h2 className="text-xl font-semibold text-white">Bookkeeping</h2>
            )}
            <button
              onClick={toggleCollapsed}
              className="hidden lg:flex p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronLeft className="h-5 w-5 text-gray-400" />
              )}
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const active = isActive(item.href)
                const Icon = item.icon
                
                return (
                  <li key={item.href}>
                    <button
                      onClick={() => router.push(item.href)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group",
                        active
                          ? "bg-emerald-600 text-white"
                          : "hover:bg-slate-800 text-gray-400 hover:text-white"
                      )}
                      title={isCollapsed ? item.title : undefined}
                    >
                      <Icon className={cn(
                        "h-5 w-5 flex-shrink-0",
                        active ? "text-white" : "text-gray-400 group-hover:text-white"
                      )} />
                      
                      {!isCollapsed && (
                        <div className="flex-1 text-left">
                          <div className="font-medium text-sm">{item.title}</div>
                          <div className={cn(
                            "text-xs",
                            active ? "text-emerald-100" : "text-gray-500"
                          )}>
                            {item.description}
                          </div>
                        </div>
                      )}
                      
                      {!isCollapsed && item.badge && (
                        <span className="ml-auto bg-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-slate-800">
            {!isCollapsed ? (
              <div className="text-xs text-gray-500">
                <div>© 2025 Bookkeeping</div>
                <div>Version 1.0.0</div>
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}