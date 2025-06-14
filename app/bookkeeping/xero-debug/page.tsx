'use client'

import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function XeroDebugPage() {
  const router = useRouter()
  const [results, setResults] = useState<any>({})
  const [loading, setLoading] = useState<string | null>(null)

  const runTest = async (testName: string, endpoint: string, options: RequestInit = {}) => {
    setLoading(testName)
    try {
      const response = await fetch(endpoint, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      })
      
      const data = await response.json()
      setResults((prev: any) => ({
        ...prev,
        [testName]: {
          status: response.status,
          ok: response.ok,
          data,
          timestamp: new Date().toISOString()
        }
      }))
    } catch (error: any) {
      setResults((prev: any) => ({
        ...prev,
        [testName]: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="container mx-auto px-4 py-8">
        <button
          onClick={() => router.push('/bookkeeping')}
          className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>

        <h1 className="text-3xl font-bold mb-8">Xero Connection Debug</h1>

        <div className="space-y-4">
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Cookie Tests</h2>
            <div className="space-y-2">
              <button
                onClick={() => runTest('cookies', '/api/v1/xero/debug-cookies')}
                disabled={loading === 'cookies'}
                className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
              >
                {loading === 'cookies' ? 'Testing...' : 'Test Cookie Access'}
              </button>
              
              {results.cookies && (
                <pre className="mt-2 p-4 bg-slate-800 rounded overflow-x-auto text-sm">
                  {JSON.stringify(results.cookies, null, 2)}
                </pre>
              )}
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Connection Tests</h2>
            <div className="space-y-2">
              <button
                onClick={() => runTest('status', '/api/v1/xero/status')}
                disabled={loading === 'status'}
                className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 mr-2"
              >
                {loading === 'status' ? 'Testing...' : 'Test Status Endpoint'}
              </button>
              
              <button
                onClick={() => runTest('connection', '/api/v1/xero/test-connection')}
                disabled={loading === 'connection'}
                className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
              >
                {loading === 'connection' ? 'Testing...' : 'Test Connection'}
              </button>
              
              {results.status && (
                <div>
                  <h3 className="font-semibold mt-2">Status Result:</h3>
                  <pre className="mt-2 p-4 bg-slate-800 rounded overflow-x-auto text-sm">
                    {JSON.stringify(results.status, null, 2)}
                  </pre>
                </div>
              )}
              
              {results.connection && (
                <div>
                  <h3 className="font-semibold mt-2">Connection Result:</h3>
                  <pre className="mt-2 p-4 bg-slate-800 rounded overflow-x-auto text-sm">
                    {JSON.stringify(results.connection, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Sync Test</h2>
            <div className="space-y-2">
              <button
                onClick={() => runTest('sync', '/api/v1/xero/sync-gl-accounts', { method: 'POST' })}
                disabled={loading === 'sync'}
                className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
              >
                {loading === 'sync' ? 'Testing...' : 'Test GL Sync'}
              </button>
              
              {results.sync && (
                <pre className="mt-2 p-4 bg-slate-800 rounded overflow-x-auto text-sm">
                  {JSON.stringify(results.sync, null, 2)}
                </pre>
              )}
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Browser Info</h2>
            <pre className="p-4 bg-slate-800 rounded overflow-x-auto text-sm">
              {typeof window !== 'undefined' ? JSON.stringify({
                cookies: document.cookie || 'No cookies visible to JavaScript',
                userAgent: navigator.userAgent,
                location: {
                  protocol: window.location.protocol,
                  host: window.location.host,
                  pathname: window.location.pathname
                }
              }, null, 2) : 'Loading...'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}