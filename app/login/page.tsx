'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Lock, BarChart, FileText } from 'lucide-react'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const returnUrl = searchParams.get('returnUrl') || '/finance'
  const connected = searchParams.get('connected') === 'true'
  
  useEffect(() => {
    // If we're connected, redirect to the return URL
    if (connected) {
      router.push(returnUrl)
    }
  }, [connected, returnUrl, router])
  
  const handleLogin = () => {
    // Pass return URL to auth endpoint
    window.location.href = `/api/v1/xero/auth?returnUrl=${encodeURIComponent(returnUrl)}`
  }
  
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-brand-emerald/5 via-transparent to-brand-purple/5" />
      <Card className="relative w-full max-w-md bg-secondary backdrop-blur-sm border-default">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl sm:text-3xl font-bold text-white">Welcome to Bookkeeping</CardTitle>
          <CardDescription className="text-tertiary">
            Sign in with your Xero account to access your financial data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-brand-emerald mt-0.5" />
              <div>
                <h3 className="font-medium text-white">Secure Authentication</h3>
                <p className="text-sm text-tertiary">
                  OAuth 2.0 with PKCE for enhanced security
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Lock className="w-5 h-5 text-brand-emerald mt-0.5" />
              <div>
                <h3 className="font-medium text-white">Bank-level Security</h3>
                <p className="text-sm text-tertiary">
                  Your credentials are never stored on our servers
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <BarChart className="w-5 h-5 text-brand-emerald mt-0.5" />
              <div>
                <h3 className="font-medium text-white">Real-time Analytics</h3>
                <p className="text-sm text-tertiary">
                  Access your financial insights instantly
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <FileText className="w-5 h-5 text-brand-emerald mt-0.5" />
              <div>
                <h3 className="font-medium text-white">Automated Bookkeeping</h3>
                <p className="text-sm text-tertiary">
                  Sync transactions and invoices automatically
                </p>
              </div>
            </div>
          </div>
          
          <Button 
            onClick={handleLogin}
            className="w-full bg-brand-emerald hover:bg-brand-emerald-dark text-white"
            size="lg"
          >
            Sign in with Xero
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