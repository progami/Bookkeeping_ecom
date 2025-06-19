'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
// Remove logging for now
const logger = { info: console.log, error: console.error, warn: console.warn }

interface Organization {
  tenantId: string
  tenantName: string
  tenantType: string
}

interface User {
  userId: string
  email: string
  tenantId: string
  tenantName: string
}

interface AuthState {
  // User authentication state
  isAuthenticated: boolean
  user: User | null
  
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
  signIn: () => void
  signOut: () => Promise<void>
  connectToXero: () => void
  disconnectFromXero: () => Promise<void>
  syncData: () => Promise<void>
  checkAuthStatus: () => Promise<void>
  // Alias for compatibility
  hasXeroConnection: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
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
    logger.info('Checking auth status...')
    
    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      logger.warn('Auth check timeout - setting default state')
      setAuthState(prev => ({
        ...prev,
        isAuthenticated: false,
        user: null,
        isLoading: false
      }))
    }, 5000) // 5 second timeout
    
    try {
      // Check user session first
      const sessionRes = await fetch('/api/v1/auth/session', { 
        credentials: 'include',
        // Add timeout to fetch
        signal: AbortSignal.timeout(4000)
      })
      const sessionData = await sessionRes.json()
      
      clearTimeout(timeout)
      
      if (!sessionData.authenticated) {
        logger.info('No user session found')
        setAuthState(prev => ({
          ...prev,
          isAuthenticated: false,
          user: null,
          isLoading: false
        }))
        return
      }
      
      // User is authenticated, check database state and Xero connection
      const [dbStatusRes, xeroStatusRes] = await Promise.all([
        fetch('/api/v1/database/status', { credentials: 'include' }),
        fetch('/api/v1/xero/status', { credentials: 'include' })
      ])

      const dbStatus = await dbStatusRes.json()
      const xeroStatus = await xeroStatusRes.json()
      
      logger.info('Status check complete', {
        hasSession: true,
        hasData: dbStatus.hasData,
        xeroConnected: xeroStatus.connected,
        lastSync: dbStatus.lastSync
      })

      setAuthState(prev => ({
        ...prev,
        isAuthenticated: true,
        user: sessionData.user,
        hasData: dbStatus.hasData || false,
        lastSync: dbStatus.lastSync,
        hasActiveToken: xeroStatus.connected || false,
        organization: xeroStatus.organization,
        isLoading: false
      }))

      // Auto-sync on first launch if connected but no data
      if (xeroStatus.connected && !dbStatus.hasData && !authState.isSyncing) {
        logger.info('First time setup - initiating auto sync...')
        await syncData()
      }
    } catch (error) {
      logger.error('Failed to check auth status', error)
      clearTimeout(timeout)
      setAuthState(prev => ({ ...prev, isLoading: false }))
    }
  }

  const signIn = () => {
    // Redirect to login page which will handle Xero OAuth
    window.location.href = '/login'
  }
  
  const signOut = async () => {
    try {
      const response = await fetch('/api/v1/auth/signout', {
        method: 'POST',
        credentials: 'include'
      })
      
      if (response.ok) {
        // Clear auth state
        setAuthState({
          isAuthenticated: false,
          user: null,
          hasData: false,
          lastSync: null,
          hasActiveToken: false,
          organization: null,
          isLoading: false,
          isSyncing: false
        })
        
        // Redirect to login
        window.location.href = '/login'
      } else {
        toast.error('Failed to sign out')
      }
    } catch (error) {
      logger.error('Failed to sign out', error)
      toast.error('Error signing out')
    }
  }
  
  const connectToXero = () => {
    window.location.href = '/api/v1/xero/auth'
  }

  const disconnectFromXero = async () => {
    console.log('[AuthContext] Starting disconnect...');
    try {
      const response = await fetch('/api/v1/xero/disconnect', { 
        method: 'POST',
        credentials: 'include'
      })
      
      console.log('[AuthContext] Disconnect response:', response.status);
      
      if (response.ok) {
        console.log('[AuthContext] Disconnect successful, updating state...');
        // Immediately update local state to show disconnected
        setAuthState(prev => {
          const newState = {
            ...prev,
            hasActiveToken: false,
            organization: null,
            // Keep hasData true as we still have data in the database
            hasData: prev.hasData
          };
          logger.info('Xero disconnected', { hasData: newState.hasData });
          return newState;
        })
        
        toast.success('Disconnected from Xero')
        
        // Don't re-check auth status immediately as it might override our state update
        // The state update above should be sufficient
      } else {
        toast.error('Failed to disconnect from Xero')
      }
    } catch (error) {
      logger.error('Failed to disconnect from Xero', error)
      toast.error('Error disconnecting from Xero')
    }
  }

  const syncData = async () => {
    if (authState.isSyncing) return
    
    setAuthState(prev => ({ ...prev, isSyncing: true }))
    toast.loading('Syncing data from Xero...', { id: 'sync-toast' })
    
    try {
      const response = await fetch('/api/v1/xero/sync', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ forceFullSync: false })
      })
      
      if (response.ok) {
        const result = await response.json()
        const summary = result.summary
        const totalRecords = (summary?.transactions || 0) + 
                           (summary?.invoices || 0) + 
                           (summary?.bills || 0) +
                           (summary?.glAccounts || 0) +
                           (summary?.bankAccounts || 0)
        
        toast.dismiss('sync-toast')
        toast.success(`Sync complete! ${totalRecords} records synced.`)
        
        // Add a small delay to ensure database writes are complete
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Refresh auth status to update hasData and lastSync
        await checkAuthStatus()
      } else if (response.status === 401) {
        // Token expired
        toast.dismiss('sync-toast')
        toast.error('Xero session expired. Please reconnect.')
        setAuthState(prev => ({ ...prev, hasActiveToken: false }))
      } else {
        const errorData = await response.json().catch(() => ({}))
        logger.error('Sync failed', errorData)
        toast.dismiss('sync-toast')
        toast.error(errorData.message || 'Sync failed. Please try again.')
      }
    } catch (error) {
      logger.error('Sync error', error)
      toast.dismiss('sync-toast')
      toast.error('Failed to sync data')
    } finally {
      setAuthState(prev => ({ ...prev, isSyncing: false }))
    }
  }

  const contextValue: AuthContextType = {
    ...authState,
    signIn,
    signOut,
    connectToXero,
    disconnectFromXero,
    syncData,
    checkAuthStatus,
    // Alias for compatibility
    hasXeroConnection: authState.hasActiveToken
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