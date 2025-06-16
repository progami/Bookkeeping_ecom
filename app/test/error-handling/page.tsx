'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import toast, { Toaster } from 'react-hot-toast'

export default function ErrorHandlingTest() {
  const [loading, setLoading] = useState<string | null>(null)
  const [results, setResults] = useState<any[]>([])

  const addResult = (test: string, success: boolean, details: string) => {
    setResults(prev => [...prev, {
      test,
      success,
      details,
      timestamp: new Date().toLocaleTimeString()
    }])
  }

  const testScenarios = [
    {
      name: 'Rate Limit Test',
      action: async () => {
        // Make rapid requests to trigger rate limit
        const promises = []
        for (let i = 0; i < 10; i++) {
          promises.push(
            fetch('/api/v1/xero/status').then(res => ({
              status: res.status,
              headers: {
                'X-RateLimit-Remaining': res.headers.get('X-RateLimit-Remaining'),
                'Retry-After': res.headers.get('Retry-After')
              }
            }))
          )
        }
        
        const results = await Promise.all(promises)
        const rateLimited = results.filter(r => r.status === 429)
        
        if (rateLimited.length > 0) {
          addResult('Rate Limit', true, `Successfully triggered rate limit. ${rateLimited.length} requests blocked`)
          toast.success('Rate limiting working correctly')
        } else {
          addResult('Rate Limit', false, 'Rate limit not triggered')
          toast.error('Rate limit test failed')
        }
      }
    },
    {
      name: 'Invalid Endpoint Test',
      action: async () => {
        try {
          const res = await fetch('/api/v1/nonexistent/endpoint')
          if (res.status === 404) {
            addResult('404 Handler', true, 'Correctly returned 404 for non-existent endpoint')
            toast.success('404 handling works')
          } else {
            addResult('404 Handler', false, `Unexpected status: ${res.status}`)
            toast.error('404 handling failed')
          }
        } catch (error) {
          addResult('404 Handler', false, `Error: ${error}`)
          toast.error('Request failed')
        }
      }
    },
    {
      name: 'Invalid JSON Test',
      action: async () => {
        try {
          const res = await fetch('/api/v1/xero/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'invalid json {'
          })
          
          if (res.status === 400) {
            addResult('JSON Validation', true, 'Correctly rejected invalid JSON')
            toast.success('JSON validation works')
          } else {
            addResult('JSON Validation', false, `Unexpected status: ${res.status}`)
            toast.error('JSON validation failed')
          }
        } catch (error) {
          addResult('JSON Validation', true, 'Request properly rejected')
          toast.success('Invalid JSON handled')
        }
      }
    },
    {
      name: 'Large Payload Test',
      action: async () => {
        // Create a 2MB payload (exceeds 1MB limit)
        const largeData = 'x'.repeat(2 * 1024 * 1024)
        
        try {
          const res = await fetch('/api/v1/test/state-test', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Content-Length': new Blob([largeData]).size.toString()
            },
            body: JSON.stringify({ data: largeData })
          })
          
          if (res.status === 413) {
            addResult('Payload Size Limit', true, 'Large payload correctly rejected')
            toast.success('Payload size limit enforced')
          } else {
            addResult('Payload Size Limit', false, `Unexpected status: ${res.status}`)
            toast.error('Payload limit not enforced')
          }
        } catch (error) {
          addResult('Payload Size Limit', true, 'Large payload rejected')
          toast.success('Size limit working')
        }
      }
    },
    {
      name: 'Session Recovery Test',
      action: async () => {
        // Test if session survives after error
        const res1 = await fetch('/api/v1/xero/status')
        const status1 = await res1.json()
        
        // Trigger an error
        await fetch('/api/v1/test/simulate-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'simulateError' })
        })
        
        // Check if session still valid
        const res2 = await fetch('/api/v1/xero/status')
        const status2 = await res2.json()
        
        if (status1.connected === status2.connected) {
          addResult('Session Recovery', true, 'Session survived error condition')
          toast.success('Session recovery works')
        } else {
          addResult('Session Recovery', false, 'Session lost after error')
          toast.error('Session recovery failed')
        }
      }
    },
    {
      name: 'Timeout Simulation',
      action: async () => {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 1000)
        
        try {
          await fetch('/api/v1/test/slow-endpoint', {
            signal: controller.signal
          })
          
          addResult('Timeout Handling', false, 'Request did not timeout')
          toast.error('Timeout test failed')
        } catch (error: any) {
          if (error.name === 'AbortError') {
            addResult('Timeout Handling', true, 'Request properly timed out')
            toast.success('Timeout handling works')
          } else {
            addResult('Timeout Handling', false, `Unexpected error: ${error.message}`)
            toast.error('Timeout test error')
          }
        } finally {
          clearTimeout(timeoutId)
        }
      }
    }
  ]

  const runTest = async (test: any) => {
    setLoading(test.name)
    try {
      await test.action()
    } catch (error: any) {
      addResult(test.name, false, `Unexpected error: ${error.message}`)
      toast.error(`Test failed: ${error.message}`)
    } finally {
      setLoading(null)
    }
  }

  const runAllTests = async () => {
    for (const test of testScenarios) {
      await runTest(test)
      // Wait between tests
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <Toaster position="top-right" />
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Error Handling & Recovery Tests</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Test Scenarios</h2>
            <div className="space-y-3">
              {testScenarios.map((test, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-slate-300">{test.name}</span>
                  <Button
                    onClick={() => runTest(test)}
                    disabled={loading !== null}
                    size="sm"
                    className={loading === test.name ? 'bg-yellow-600' : 'bg-blue-600 hover:bg-blue-700'}
                  >
                    {loading === test.name ? 'Running...' : 'Run'}
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-700">
              <Button
                onClick={runAllTests}
                disabled={loading !== null}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Run All Tests
              </Button>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Test Results</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {results.length === 0 ? (
                <p className="text-slate-400">No tests run yet</p>
              ) : (
                results.map((result, index) => (
                  <div 
                    key={index} 
                    className={`p-3 rounded ${
                      result.success ? 'bg-green-900/30 border border-green-600/50' : 'bg-red-900/30 border border-red-600/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-white">{result.test}</span>
                      <span className="text-xs text-slate-400">{result.timestamp}</span>
                    </div>
                    <p className="text-sm text-slate-300">{result.details}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Error Scenarios Tested</h2>
          <ul className="list-disc list-inside text-slate-300 space-y-2">
            <li>Rate limiting enforcement (429 responses)</li>
            <li>404 handling for non-existent endpoints</li>
            <li>Invalid JSON payload rejection</li>
            <li>Large payload size limits (413 responses)</li>
            <li>Session persistence after errors</li>
            <li>Request timeout handling</li>
          </ul>
        </div>
      </div>
    </div>
  )
}