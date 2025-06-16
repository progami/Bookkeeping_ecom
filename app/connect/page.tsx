'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Lock, BarChart, FileText, Cloud, Database, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function ConnectXeroPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { hasActiveToken, checkAuthStatus } = useAuth()
  const returnUrl = searchParams.get('returnUrl') || '/setup'
  const connected = searchParams.get('connected') === 'true'
  
  useEffect(() => {
    // If already connected, redirect to setup
    if (hasActiveToken || connected) {
      router.push(returnUrl)
    }
  }, [hasActiveToken, connected, returnUrl, router])
  
  const handleConnect = () => {
    // Pass return URL to auth endpoint
    window.location.href = `/api/v1/xero/auth?returnUrl=${encodeURIComponent(returnUrl)}`
  }
  
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-emerald/5 via-transparent to-brand-purple/5" />
      <Card className="relative w-full max-w-md bg-secondary backdrop-blur-sm border-default">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl sm:text-3xl font-bold text-white">Connect to Xero</CardTitle>
          <CardDescription className="text-tertiary">
            Link your Xero account to import your financial data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-brand-emerald mt-0.5" />
              <div>
                <h3 className="font-medium text-white">Secure Connection</h3>
                <p className="text-sm text-tertiary">
                  OAuth 2.0 with bank-level encryption
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Database className="w-5 h-5 text-brand-blue mt-0.5" />
              <div>
                <h3 className="font-medium text-white">Your Data, Locally</h3>
                <p className="text-sm text-tertiary">
                  All data is synced to your local database
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <RefreshCw className="w-5 h-5 text-brand-purple mt-0.5" />
              <div>
                <h3 className="font-medium text-white">Auto-Sync</h3>
                <p className="text-sm text-tertiary">
                  Automatic updates every 30 minutes
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Cloud className="w-5 h-5 text-cyan-400 mt-0.5" />
              <div>
                <h3 className="font-medium text-white">Read-Only Access</h3>
                <p className="text-sm text-tertiary">
                  We only read your data, never modify it
                </p>
              </div>
            </div>
          </div>
          
          <Button 
            onClick={handleConnect}
            className="w-full bg-brand-emerald hover:bg-brand-emerald-dark text-white"
            size="lg"
          >
            <Cloud className="mr-2 h-5 w-5" />
            Connect to Xero
          </Button>
          
          <p className="text-xs text-center text-muted">
            By signing in, you agree to our terms of service and privacy policy.
            Your Xero data will be synced securely to provide financial insights.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}