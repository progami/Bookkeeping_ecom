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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Welcome to Bookkeeping</CardTitle>
          <CardDescription>
            Sign in with your Xero account to access your financial data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium">Secure Authentication</h3>
                <p className="text-sm text-muted-foreground">
                  OAuth 2.0 with PKCE for enhanced security
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Lock className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium">Bank-level Security</h3>
                <p className="text-sm text-muted-foreground">
                  Your credentials are never stored on our servers
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <BarChart className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium">Real-time Analytics</h3>
                <p className="text-sm text-muted-foreground">
                  Access your financial insights instantly
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium">Automated Bookkeeping</h3>
                <p className="text-sm text-muted-foreground">
                  Sync transactions and invoices automatically
                </p>
              </div>
            </div>
          </div>
          
          <Button 
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
          >
            Sign in with Xero
          </Button>
          
          <p className="text-xs text-center text-muted-foreground">
            By signing in, you agree to our terms of service and privacy policy.
            Your Xero data will be synced securely to provide financial insights.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}