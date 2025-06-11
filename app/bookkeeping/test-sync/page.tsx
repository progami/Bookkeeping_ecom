'use client'

import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function TestSyncPage() {
  const router = useRouter()
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runTests = async (endpoint: string) => {
    setLoading(true)
    setError(null)
    setResults(null)
    
    try {
      const response = await fetch(endpoint)
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Request failed')
      }
      
      setResults(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const runManualSync = async () => {
    setLoading(true)
    setError(null)
    setResults(null)
    
    try {
      const response = await fetch('/api/v1/xero/manual-sync', {
        method: 'POST'
      })
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Sync failed')
      }
      
      setResults(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <button
        onClick={() => router.push('/bookkeeping')}
        className="text-gray-400 hover:text-white transition-colors mb-4 inline-flex items-center"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </button>

      <h1 className="text-3xl font-bold text-white mb-8">Xero Sync Testing</h1>
      
      <div className="space-y-6">
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Connection Tests</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => runTests('/api/v1/xero/debug-connection')}
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              Debug Connection
            </button>
            
            <button
              onClick={() => runTests('/api/v1/xero/status')}
              disabled={loading}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition-colors"
            >
              Check Status
            </button>
            
            <button
              onClick={() => runTests('/api/v1/xero/test')}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              Test API
            </button>
            
            <button
              onClick={() => runTests('/api/v1/xero/test-sync-pagination')}
              disabled={loading}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              Test Pagination
            </button>
          </div>
        </div>
        
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Sync Tests</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={runManualSync}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              Run Manual Sync
            </button>
            
            <button
              onClick={() => runTests('/api/v1/xero/sync-status')}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              Check Sync Status
            </button>
          </div>
        </div>
        
        {loading && (
          <div className="text-center text-gray-400">
            <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            Running test...
          </div>
        )}
        
        {error && (
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
            <h3 className="text-red-400 font-semibold mb-2">Error:</h3>
            <p className="text-red-300">{error}</p>
          </div>
        )}
        
        {results && (
          <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-4">Results:</h3>
            <pre className="text-gray-300 text-sm overflow-auto max-h-96 bg-slate-900/50 p-4 rounded-lg">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}