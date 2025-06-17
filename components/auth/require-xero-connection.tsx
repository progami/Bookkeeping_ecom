'use client'

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { XeroConnectionRequired } from '@/components/ui/xero-connection-required'
import { Loader2 } from 'lucide-react'

interface RequireXeroConnectionProps {
  children: React.ReactNode
  pageConfig: {
    title: string
    description: string
    features: {
      icon: React.ReactNode
      title: string
      description: string
    }[]
  }
}

export function RequireXeroConnection({ children, pageConfig }: RequireXeroConnectionProps) {
  const { hasActiveToken, isLoading, checkAuthStatus } = useAuth()

  useEffect(() => {
    // Recheck auth status when component mounts
    checkAuthStatus()
  }, [])

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-brand-emerald animate-spin" />
      </div>
    )
  }

  // Show connection required if no Xero token
  if (!hasActiveToken) {
    return <XeroConnectionRequired {...pageConfig} />
  }

  // User has Xero connection, show the actual page content
  return <>{children}</>
}