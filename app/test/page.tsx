'use client'

import { useState, useEffect } from 'react'

export default function TestPage() {
  const [count, setCount] = useState(0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    console.log('Test page mounted')
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Test Page</h1>
      <p>Mounted: {mounted ? 'Yes' : 'No'}</p>
      <p>Count: {count}</p>
      <button 
        onClick={() => setCount(count + 1)}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Increment
      </button>
    </div>
  )
}