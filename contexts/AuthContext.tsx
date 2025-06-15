'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface Organization {
  tenantId: string
  tenantName: string
  tenantType: string
}

interface AuthState {
  // Database state - do we have data?
  hasData: boolean
  lastSync: string | null
  
  // Xero connection state - can we sync?
  hasActiveToken: boolean
  organization: Organization | null
  
  // Loading states
  isLoading: boolean
  isSyncing: boolean
}

interface AuthContextType extends AuthState {
  // Actions
  connectToXero: () => void
  syncData: () => Promise<void>
  checkAuthStatus: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [authState, setAuthState] = useState<AuthState>({
    hasData: false,
    lastSync: null,
    hasActiveToken: false,
    organization: null,
    isLoading: true,
    isSyncing: false
  })

  // Check auth status on mount and after certain actions
  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      // Check both database state and Xero connection in parallel
      const [dbStatusRes, xeroStatusRes] = await Promise.all([
        fetch('/api/v1/database/status'),
        fetch('/api/v1/xero/status')
      ])

      const dbStatus = await dbStatusRes.json()
      const xeroStatus = await xeroStatusRes.json()

      setAuthState(prev => ({
        ...prev,
        hasData: dbStatus.hasData || false,
        lastSync: dbStatus.lastSync,
        hasActiveToken: xeroStatus.connected || false,
        organization: xeroStatus.organization,
        isLoading: false
      }))

      // Auto-sync on first launch if connected but no data
      if (xeroStatus.connected && !dbStatus.hasData && !authState.isSyncing) {
        console.log('First time setup - initiating auto sync...')
        await syncData()
      }
    } catch (error) {
      console.error('Error checking auth status:', error)
      setAuthState(prev => ({ ...prev, isLoading: false }))
    }
  }

  const connectToXero = () => {
    window.location.href = '/api/v1/xero/auth'
  }

  const syncData = async () => {
    if (authState.isSyncing) return
    
    setAuthState(prev => ({ ...prev, isSyncing: true }))
    
    try {
      const response = await fetch('/api/v1/xero/sync', { method: 'POST' })
      
      if (response.ok) {
        const result = await response.json()
        toast.success(`Sync complete! ${result.summary.totalSynced} records synced.`)
        
        // Refresh auth status to update hasData and lastSync
        await checkAuthStatus()
      } else if (response.status === 401) {
        // Token expired
        toast.error('Xero session expired. Please reconnect.')
        setAuthState(prev => ({ ...prev, hasActiveToken: false }))
      } else {
        toast.error('Sync failed. Please try again.')
      }
    } catch (error) {
      console.error('Sync error:', error)
      toast.error('Failed to sync data')
    } finally {
      setAuthState(prev => ({ ...prev, isSyncing: false }))
    }
  }

  const contextValue: AuthContextType = {
    ...authState,
    connectToXero,
    syncData,
    checkAuthStatus
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// HOC for protected pages that need Xero connection
export function withXeroConnection<P extends object>(
  Component: React.ComponentType<P>
) {
  return function ProtectedComponent(props: P) {
    const { hasActiveToken, isLoading } = useAuth()
    const router = useRouter()

    useEffect(() => {
      if (!isLoading && !hasActiveToken) {
        router.push('/bookkeeping?connect=true')
      }
    }, [hasActiveToken, isLoading, router])

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      )
    }

    if (!hasActiveToken) {
      return null
    }

    return <Component {...props} />
  }
}

// HOC for pages that only need data (no active Xero connection required)
export function withData<P extends object>(
  Component: React.ComponentType<P>
) {
  return function DataProtectedComponent(props: P) {
    const { hasData, isLoading } = useAuth()
    const router = useRouter()

    useEffect(() => {
      if (!isLoading && !hasData) {
        router.push('/bookkeeping?setup=true')
      }
    }, [hasData, isLoading, router])

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      )
    }

    if (!hasData) {
      return null
    }

    return <Component {...props} />
  }
}