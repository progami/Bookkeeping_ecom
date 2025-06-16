'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

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
    console.log('[AuthContext] Checking auth status...')
    try {
      // Check user session first
      const sessionRes = await fetch('/api/v1/auth/session')
      const sessionData = await sessionRes.json()
      
      if (!sessionData.authenticated) {
        console.log('[AuthContext] No user session found')
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
        fetch('/api/v1/database/status'),
        fetch('/api/v1/xero/status')
      ])

      const dbStatus = await dbStatusRes.json()
      const xeroStatus = await xeroStatusRes.json()
      
      console.log('[AuthContext] Status check results:', {
        session: sessionData,
        dbStatus: { hasData: dbStatus.hasData, lastSync: dbStatus.lastSync },
        xeroStatus: { connected: xeroStatus.connected, organization: xeroStatus.organization }
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
        console.log('First time setup - initiating auto sync...')
        await syncData()
      }
    } catch (error) {
      console.error('Error checking auth status:', error)
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
      console.error('Error signing out:', error)
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
          console.log('[AuthContext] Previous state:', prev);
          const newState = {
            ...prev,
            hasActiveToken: false,
            organization: null,
            // Keep hasData true as we still have data in the database
            hasData: prev.hasData
          };
          console.log('[AuthContext] New state:', newState);
          return newState;
        })
        
        toast.success('Disconnected from Xero')
        
        // Don't re-check auth status immediately as it might override our state update
        // The state update above should be sufficient
      } else {
        toast.error('Failed to disconnect from Xero')
      }
    } catch (error) {
      console.error('[AuthContext] Error disconnecting from Xero:', error)
      toast.error('Error disconnecting from Xero')
    }
  }

  const syncData = async () => {
    if (authState.isSyncing) return
    
    setAuthState(prev => ({ ...prev, isSyncing: true }))
    
    try {
      const response = await fetch('/api/v1/xero/sync-simple', { method: 'POST' })
      
      if (response.ok) {
        const result = await response.json()
        const totalSynced = result.bankAccountsSynced || 
                           ((result.summary?.transactions || 0) + 
                            (result.summary?.invoices || 0) + 
                            (result.summary?.bills || 0))
        toast.success(`Sync complete! ${totalSynced} records synced.`)
        
        // Refresh auth status to update hasData and lastSync
        await checkAuthStatus()
      } else if (response.status === 401) {
        // Token expired
        toast.error('Xero session expired. Please reconnect.')
        setAuthState(prev => ({ ...prev, hasActiveToken: false }))
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Sync failed:', errorData)
        toast.error(errorData.message || 'Sync failed. Please try again.')
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
    signIn,
    signOut,
    connectToXero,
    disconnectFromXero,
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