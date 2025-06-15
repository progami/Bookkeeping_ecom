'use client'

import { ReactNode, createContext, useContext, useState, useEffect } from 'react'
import { SidebarNavigation } from '@/components/ui/sidebar-navigation'
import { Toaster } from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface AppLayoutProps {
  children: ReactNode
}

interface SidebarContextType {
  isCollapsed: boolean
  setIsCollapsed: (value: boolean) => void
}

const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  setIsCollapsed: () => {},
})

export const useSidebar = () => useContext(SidebarContext)

export function AppLayout({ children }: AppLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved) {
      setIsCollapsed(saved === 'true')
    }
  }, [])

  if (!mounted) {
    return null // Prevent hydration mismatch
  }

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      <div className="min-h-screen bg-slate-950">
        <Toaster 
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e293b',
              color: '#fff',
              border: '1px solid #334155',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        
        {/* Sidebar Navigation */}
        <SidebarNavigation />
        
        {/* Main Content Area */}
        <main 
          className={cn(
            "min-h-screen transition-all duration-300 pt-16 lg:pt-0",
            isCollapsed ? "lg:pl-20" : "lg:pl-64"
          )}
        >
          {children}
        </main>
      </div>
    </SidebarContext.Provider>
  )
}