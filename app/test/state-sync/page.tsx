'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function StateSyncTest() {
  const [state, setState] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(true)

  // Poll for state changes
  useEffect(() => {
    if (!polling) return

    const fetchState = async () => {
      try {
        const res = await fetch('/api/v1/test/state-test')
        const data = await res.json()
        setState(data)
      } catch (error) {
        console.error('Failed to fetch state:', error)
      }
    }

    // Initial fetch
    fetchState()

    // Poll every 2 seconds
    const interval = setInterval(fetchState, 2000)

    return () => clearInterval(interval)
  }, [polling])

  const updateState = async (action: string, value?: number) => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/test/state-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, value })
      })
      const data = await res.json()
      setState(data.newState)
    } catch (error) {
      console.error('Failed to update state:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">State Synchronization Test</h1>
        
        <div className="bg-slate-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Current State</h2>
          {state ? (
            <div className="space-y-2 text-slate-300">
              <p>Counter: <span className="text-white font-bold text-2xl">{state.counter}</span></p>
              <p>Active Users: <span className="text-white font-bold">{state.activeUsers}</span></p>
              <p>Last Updated: <span className="text-white">{new Date(state.lastUpdated).toLocaleTimeString()}</span></p>
              <p>Current Time: <span className="text-white">{new Date(state.timestamp).toLocaleTimeString()}</span></p>
            </div>
          ) : (
            <p className="text-slate-400">Loading state...</p>
          )}
        </div>

        <div className="bg-slate-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Actions</h2>
          <div className="flex gap-4 flex-wrap">
            <Button 
              onClick={() => updateState('increment')}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              Increment (+1)
            </Button>
            <Button 
              onClick={() => updateState('decrement')}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              Decrement (-1)
            </Button>
            <Button 
              onClick={() => updateState('reset')}
              disabled={loading}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              Reset to 0
            </Button>
            <Button 
              onClick={() => updateState('setActiveUsers', Math.floor(Math.random() * 10) + 1)}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Random Active Users
            </Button>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Polling Control</h2>
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={polling}
              onChange={(e) => setPolling(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-white">Enable auto-refresh (polls every 2 seconds)</span>
          </label>
        </div>

        <div className="mt-8 text-slate-400 text-sm">
          <p>Open this page in multiple tabs to test state synchronization.</p>
          <p>Changes made in one tab should appear in all other tabs within 2 seconds.</p>
        </div>
      </div>
    </div>
  )
}