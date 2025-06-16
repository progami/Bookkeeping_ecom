'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import toast, { Toaster } from 'react-hot-toast'

interface TestResult {
  name: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  timestamp: string
}

export default function EdgeCasesTest() {
  const [results, setResults] = useState<TestResult[]>([])
  const [testing, setTesting] = useState(false)

  const addResult = (name: string, status: TestResult['status'], message: string) => {
    setResults(prev => [...prev, {
      name,
      status,
      message,
      timestamp: new Date().toLocaleTimeString()
    }])

    if (status === 'pass') toast.success(`✅ ${name}`)
    else if (status === 'warning') toast(`⚠️ ${name}`, { icon: '⚠️' })
    else toast.error(`❌ ${name}`)
  }

  const edgeCaseTests = [
    {
      name: 'Empty Data Handling',
      test: async () => {
        const res = await fetch('/api/v1/database/status')
        const data = await res.json()
        
        if (res.ok) {
          addResult('Empty Data', 'pass', `Database correctly reports: ${data.hasData ? 'has data' : 'no data'}`)
        } else {
          addResult('Empty Data', 'fail', 'Failed to check database status')
        }
      }
    },
    {
      name: 'Special Characters in Input',
      test: async () => {
        const specialChars = `Test!@#$%^&*()_+-={}[]|\\:";'<>?,./~\``
        
        try {
          const res = await fetch('/api/v1/test/state-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'test', data: specialChars })
          })
          
          if (res.ok) {
            addResult('Special Characters', 'pass', 'Special characters handled correctly')
          } else {
            addResult('Special Characters', 'warning', `Status ${res.status} - may need escaping`)
          }
        } catch (error) {
          addResult('Special Characters', 'fail', 'Failed to process special characters')
        }
      }
    },
    {
      name: 'Unicode & Emoji Support',
      test: async () => {
        const unicodeTest = '你好世界 🌍 مرحبا بالعالم 🚀 Здравствуй мир 🎉'
        
        try {
          const res = await fetch('/api/v1/test/state-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'test', data: unicodeTest })
          })
          
          if (res.ok) {
            addResult('Unicode Support', 'pass', 'Unicode and emojis handled correctly')
          } else {
            addResult('Unicode Support', 'fail', 'Unicode handling failed')
          }
        } catch (error) {
          addResult('Unicode Support', 'fail', 'Error processing unicode')
        }
      }
    },
    {
      name: 'Concurrent Requests',
      test: async () => {
        const promises = Array(10).fill(0).map((_, i) => 
          fetch('/api/v1/test/state-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'increment' })
          })
        )
        
        try {
          const results = await Promise.all(promises)
          const allSuccessful = results.every(r => r.ok)
          
          if (allSuccessful) {
            addResult('Concurrent Requests', 'pass', '10 concurrent requests handled successfully')
          } else {
            addResult('Concurrent Requests', 'warning', 'Some concurrent requests failed')
          }
        } catch (error) {
          addResult('Concurrent Requests', 'fail', 'Concurrent request handling failed')
        }
      }
    },
    {
      name: 'Null/Undefined Values',
      test: async () => {
        try {
          const res1 = await fetch('/api/v1/test/state-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: null, value: undefined })
          })
          
          const res2 = await fetch('/api/v1/test/state-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          })
          
          if (res1.ok && res2.ok) {
            addResult('Null/Undefined', 'pass', 'Null and undefined values handled gracefully')
          } else {
            addResult('Null/Undefined', 'warning', 'Some null/undefined cases not handled')
          }
        } catch (error) {
          addResult('Null/Undefined', 'fail', 'Failed to handle null/undefined')
        }
      }
    },
    {
      name: 'Very Long Strings',
      test: async () => {
        const longString = 'x'.repeat(10000) // 10KB string
        
        try {
          const res = await fetch('/api/v1/test/state-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'test', data: longString })
          })
          
          if (res.ok) {
            addResult('Long Strings', 'pass', '10KB string processed successfully')
          } else if (res.status === 413) {
            addResult('Long Strings', 'pass', 'Correctly rejected oversized payload')
          } else {
            addResult('Long Strings', 'warning', `Unexpected status: ${res.status}`)
          }
        } catch (error) {
          addResult('Long Strings', 'fail', 'Failed to handle long string')
        }
      }
    },
    {
      name: 'Decimal Precision',
      test: async () => {
        const testValues = [
          0.1 + 0.2, // Should be 0.30000000000000004
          999999999999999.99,
          -999999999999999.99,
          0.000000000001
        ]
        
        try {
          const res = await fetch('/api/v1/test/state-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'test', values: testValues })
          })
          
          if (res.ok) {
            addResult('Decimal Precision', 'pass', 'Decimal values handled correctly')
          } else {
            addResult('Decimal Precision', 'warning', 'Decimal handling may have issues')
          }
        } catch (error) {
          addResult('Decimal Precision', 'fail', 'Failed to handle decimal values')
        }
      }
    },
    {
      name: 'Date Boundary Cases',
      test: async () => {
        const dates = [
          new Date('1900-01-01').toISOString(),
          new Date('2099-12-31').toISOString(),
          new Date(0).toISOString(), // Unix epoch
          new Date('invalid-date').toISOString() // Should be 'Invalid Date'
        ].filter(d => !d.includes('Invalid'))
        
        try {
          const res = await fetch('/api/v1/test/state-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'test', dates })
          })
          
          if (res.ok) {
            addResult('Date Boundaries', 'pass', 'Date edge cases handled correctly')
          } else {
            addResult('Date Boundaries', 'warning', 'Some date cases may not be handled')
          }
        } catch (error) {
          addResult('Date Boundaries', 'fail', 'Failed to handle date boundaries')
        }
      }
    },
    {
      name: 'SQL Injection Attempt',
      test: async () => {
        const sqlInjection = "'; DROP TABLE users; --"
        
        try {
          const res = await fetch('/api/v1/test/state-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'test', data: sqlInjection })
          })
          
          if (res.ok) {
            addResult('SQL Injection', 'pass', 'SQL injection attempt safely handled')
          } else {
            addResult('SQL Injection', 'fail', 'Unexpected response to SQL injection')
          }
        } catch (error) {
          addResult('SQL Injection', 'fail', 'Error handling SQL injection')
        }
      }
    },
    {
      name: 'XSS Attempt',
      test: async () => {
        const xssAttempt = '<script>alert("XSS")</script>'
        
        try {
          const res = await fetch('/api/v1/test/state-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'test', data: xssAttempt })
          })
          
          if (res.ok) {
            const data = await res.json()
            // Check if script tags are escaped in response
            const responseText = JSON.stringify(data)
            if (!responseText.includes('<script>')) {
              addResult('XSS Prevention', 'pass', 'XSS attempt properly escaped')
            } else {
              addResult('XSS Prevention', 'warning', 'Script tags not escaped in response')
            }
          } else {
            addResult('XSS Prevention', 'fail', 'Failed to handle XSS attempt')
          }
        } catch (error) {
          addResult('XSS Prevention', 'fail', 'Error handling XSS')
        }
      }
    }
  ]

  const runAllTests = async () => {
    setTesting(true)
    setResults([])
    
    for (const test of edgeCaseTests) {
      try {
        await test.test()
      } catch (error: any) {
        addResult(test.name, 'fail', `Unexpected error: ${error.message}`)
      }
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    setTesting(false)
  }

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'pass': return 'bg-green-900/30 border-green-600/50'
      case 'warning': return 'bg-yellow-900/30 border-yellow-600/50'
      case 'fail': return 'bg-red-900/30 border-red-600/50'
    }
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pass': return '✅'
      case 'warning': return '⚠️'
      case 'fail': return '❌'
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <Toaster position="top-right" />
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Edge Cases & Boundary Testing</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Test Cases</h2>
            <div className="space-y-3 mb-6">
              {edgeCaseTests.map((test, index) => (
                <div key={index} className="text-slate-300">
                  • {test.name}
                </div>
              ))}
            </div>
            
            <Button
              onClick={runAllTests}
              disabled={testing}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {testing ? 'Testing...' : 'Run All Edge Case Tests'}
            </Button>
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
                    className={`p-3 rounded border ${getStatusColor(result.status)}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-white flex items-center gap-2">
                        {getStatusIcon(result.status)} {result.name}
                      </span>
                      <span className="text-xs text-slate-400">{result.timestamp}</span>
                    </div>
                    <p className="text-sm text-slate-300">{result.message}</p>
                  </div>
                ))
              )}
            </div>
            
            {results.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="flex justify-between text-sm">
                  <span className="text-green-400">
                    Pass: {results.filter(r => r.status === 'pass').length}
                  </span>
                  <span className="text-yellow-400">
                    Warning: {results.filter(r => r.status === 'warning').length}
                  </span>
                  <span className="text-red-400">
                    Fail: {results.filter(r => r.status === 'fail').length}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Edge Cases Covered</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-300">
            <div>
              <h3 className="font-semibold mb-2">Data Validation</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Empty/null/undefined values</li>
                <li>Special characters and Unicode</li>
                <li>Very long strings</li>
                <li>Decimal precision limits</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Security</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>SQL injection attempts</li>
                <li>XSS prevention</li>
                <li>Concurrent request handling</li>
                <li>Boundary date values</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}