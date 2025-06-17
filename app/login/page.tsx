'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, LogIn, AlertCircle } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const router = useRouter()
  // Auto-fill for testing - remove in production
  const [email, setEmail] = useState('ajarrar@trademanenterprise.com')
  const [password, setPassword] = useState('gW2r4*8&wFM.#fZ')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Invalid credentials')
      }

      toast.success('Login successful!')
      
      // Check setup status and redirect accordingly
      const setupStatus = await fetch('/api/v1/setup/status').then(r => r.json())
      
      if (!setupStatus.hasXeroConnection) {
        router.push('/connect')
      } else {
        // Always go to sync page after login to ensure data is fresh
        router.push('/sync')
      }
    } catch (err: any) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <Toaster position="top-right" />
      
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-gray-400">Sign in to your financial hub</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(
                    "w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700",
                    "rounded-lg text-white placeholder-gray-500",
                    "focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent",
                    "transition-all duration-200"
                  )}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(
                    "w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700",
                    "rounded-lg text-white placeholder-gray-500",
                    "focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent",
                    "transition-all duration-200"
                  )}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="w-4 h-4 bg-slate-800 border-slate-700 rounded text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-400">Remember me</span>
              </label>
              <Link href="/forgot-password" className="text-sm text-emerald-400 hover:text-emerald-300">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-base font-medium"
              size="lg"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="h-5 w-5" />
                  Sign In
                </span>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-center text-gray-400">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-emerald-400 hover:text-emerald-300 font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}