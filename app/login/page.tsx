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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-purple-500/5" />
      <Card className="relative w-full max-w-md bg-slate-800/30 backdrop-blur-sm border-slate-700/50">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl sm:text-3xl font-bold text-white">Welcome to Bookkeeping</CardTitle>
          <CardDescription className="text-gray-400">
            Sign in with your Xero account to access your financial data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-emerald-400 mt-0.5" />
              <div>
                <h3 className="font-medium text-white">Secure Authentication</h3>
                <p className="text-sm text-gray-400">
                  OAuth 2.0 with PKCE for enhanced security
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Lock className="w-5 h-5 text-emerald-400 mt-0.5" />
              <div>
                <h3 className="font-medium text-white">Bank-level Security</h3>
                <p className="text-sm text-gray-400">
                  Your credentials are never stored on our servers
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <BarChart className="w-5 h-5 text-emerald-400 mt-0.5" />
              <div>
                <h3 className="font-medium text-white">Real-time Analytics</h3>
                <p className="text-sm text-gray-400">
                  Access your financial insights instantly
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <FileText className="w-5 h-5 text-emerald-400 mt-0.5" />
              <div>
                <h3 className="font-medium text-white">Automated Bookkeeping</h3>
                <p className="text-sm text-gray-400">
                  Sync transactions and invoices automatically
                </p>
              </div>
            </div>
          </div>
          
          <Button 
            onClick={handleLogin}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            size="lg"
          >
            Sign in with Xero
          </Button>
          
          <p className="text-xs text-center text-gray-500">
            By signing in, you agree to our terms of service and privacy policy.
            Your Xero data will be synced securely to provide financial insights.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}