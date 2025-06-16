'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface PerformanceMetric {
  timestamp: number
  responseTime: number
  success: boolean
  endpoint: string
}

export default function PerformanceTest() {
  const [testing, setTesting] = useState(false)
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([])
  const [summary, setSummary] = useState<any>(null)

  const endpoints = [
    { url: '/api/v1/xero/status', name: 'Status Check' },
    { url: '/api/v1/database/status', name: 'DB Status' },
    { url: '/api/v1/test/state-test', name: 'State Test' },
  ]

  const runPerformanceTest = async (duration: number = 30, requestsPerSecond: number = 10) => {
    setTesting(true)
    setMetrics([])
    setSummary(null)

    const results: PerformanceMetric[] = []
    const startTime = Date.now()
    const endTime = startTime + (duration * 1000)
    const interval = 1000 / requestsPerSecond

    const makeRequest = async (endpoint: any) => {
      const start = performance.now()
      try {
        const response = await fetch(endpoint.url)
        const end = performance.now()
        const responseTime = end - start

        results.push({
          timestamp: Date.now() - startTime,
          responseTime,
          success: response.ok,
          endpoint: endpoint.name
        })

        setMetrics([...results])
      } catch (error) {
        const end = performance.now()
        results.push({
          timestamp: Date.now() - startTime,
          responseTime: end - start,
          success: false,
          endpoint: endpoint.name
        })
        setMetrics([...results])
      }
    }

    // Run tests
    const testInterval = setInterval(() => {
      if (Date.now() >= endTime) {
        clearInterval(testInterval)
        setTesting(false)

        // Calculate summary
        const successful = results.filter(r => r.success).length
        const failed = results.filter(r => !r.success).length
        const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
        const maxResponseTime = Math.max(...results.map(r => r.responseTime))
        const minResponseTime = Math.min(...results.map(r => r.responseTime))

        // Calculate percentiles
        const sortedTimes = results.map(r => r.responseTime).sort((a, b) => a - b)
        const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)]
        const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)]
        const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)]

        setSummary({
          totalRequests: results.length,
          successful,
          failed,
          successRate: (successful / results.length * 100).toFixed(2),
          avgResponseTime: avgResponseTime.toFixed(2),
          minResponseTime: minResponseTime.toFixed(2),
          maxResponseTime: maxResponseTime.toFixed(2),
          p50: p50.toFixed(2),
          p95: p95.toFixed(2),
          p99: p99.toFixed(2),
          duration,
          requestsPerSecond
        })
        return
      }

      // Make concurrent requests to different endpoints
      endpoints.forEach(endpoint => {
        makeRequest(endpoint)
      })
    }, interval)
  }

  const chartData = metrics.reduce((acc, metric) => {
    const second = Math.floor(metric.timestamp / 1000)
    if (!acc[second]) {
      acc[second] = {
        second,
        avgResponseTime: 0,
        count: 0,
        errorRate: 0,
        errors: 0
      }
    }
    acc[second].avgResponseTime += metric.responseTime
    acc[second].count += 1
    if (!metric.success) acc[second].errors += 1
    return acc
  }, {} as any)

  const formattedChartData = Object.values(chartData).map((data: any) => ({
    second: data.second,
    avgResponseTime: (data.avgResponseTime / data.count).toFixed(2),
    errorRate: ((data.errors / data.count) * 100).toFixed(2)
  }))

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Performance Load Testing</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Test Configuration</h2>
            <div className="space-y-4">
              <Button
                onClick={() => runPerformanceTest(10, 5)}
                disabled={testing}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Light Load (5 req/s, 10s)
              </Button>
              <Button
                onClick={() => runPerformanceTest(20, 10)}
                disabled={testing}
                className="w-full bg-yellow-600 hover:bg-yellow-700"
              >
                Medium Load (10 req/s, 20s)
              </Button>
              <Button
                onClick={() => runPerformanceTest(30, 20)}
                disabled={testing}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                Heavy Load (20 req/s, 30s)
              </Button>
            </div>
            
            {testing && (
              <div className="mt-6">
                <div className="animate-pulse text-center text-white">
                  <p className="text-lg">Testing in progress...</p>
                  <p className="text-sm text-slate-400">Requests sent: {metrics.length}</p>
                </div>
              </div>
            )}
          </div>

          {summary && (
            <div className="bg-slate-800 rounded-lg p-6 lg:col-span-2">
              <h2 className="text-xl font-semibold text-white mb-4">Test Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-slate-400">Total Requests</p>
                  <p className="text-2xl font-bold text-white">{summary.totalRequests}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Success Rate</p>
                  <p className="text-2xl font-bold text-green-400">{summary.successRate}%</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Failed</p>
                  <p className="text-2xl font-bold text-red-400">{summary.failed}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">Avg Response</p>
                  <p className="text-2xl font-bold text-white">{summary.avgResponseTime}ms</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">P95 Response</p>
                  <p className="text-2xl font-bold text-yellow-400">{summary.p95}ms</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">P99 Response</p>
                  <p className="text-2xl font-bold text-orange-400">{summary.p99}ms</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {formattedChartData.length > 0 && (
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Performance Metrics Over Time</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formattedChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="second" stroke="#94a3b8" label={{ value: 'Time (seconds)', position: 'insideBottom', offset: -5 }} />
                  <YAxis stroke="#94a3b8" label={{ value: 'Response Time (ms)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Legend />
                  <Line type="monotone" dataKey="avgResponseTime" stroke="#10b981" name="Avg Response Time" />
                  <Line type="monotone" dataKey="errorRate" stroke="#ef4444" name="Error Rate %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="mt-8 bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Performance Benchmarks</h2>
          <div className="space-y-2 text-slate-300">
            <p>✅ <strong>Good:</strong> Response time &lt; 200ms, Error rate &lt; 1%</p>
            <p>⚠️ <strong>Acceptable:</strong> Response time &lt; 500ms, Error rate &lt; 5%</p>
            <p>❌ <strong>Poor:</strong> Response time &gt; 500ms, Error rate &gt; 5%</p>
          </div>
        </div>
      </div>
    </div>
  )
}