'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useEffect, useState } from 'react'

export default function ThemeTestPage() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [debugInfo, setDebugInfo] = useState<any>({})

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) {
      setDebugInfo({
        theme,
        resolvedTheme,
        localStorage: typeof window !== 'undefined' ? localStorage.getItem('theme') : 'N/A',
        htmlClass: typeof document !== 'undefined' ? document.documentElement.className : 'N/A',
        bodyBg: typeof window !== 'undefined' ? window.getComputedStyle(document.body).backgroundColor : 'N/A',
        systemPrefersDark: typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : 'N/A'
      })
    }
  }, [theme, resolvedTheme, mounted])

  if (!mounted) {
    return <div>Loading...</div>
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Theme Test Page</h1>
      
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Theme Toggle Component:</h2>
        <ThemeToggle />
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Manual Theme Buttons:</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setTheme('light')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Set Light Theme
          </button>
          <button
            onClick={() => setTheme('dark')}
            className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900"
          >
            Set Dark Theme
          </button>
          <button
            onClick={() => setTheme('system')}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Set System Theme
          </button>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Debug Information:</h2>
        <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto">
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Test Elements:</h2>
        <div className="space-y-2">
          <div className="p-4 bg-white dark:bg-gray-900 text-black dark:text-white border rounded">
            This should be white in light mode, dark in dark mode
          </div>
          <div className="p-4 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border rounded">
            This should be light gray in light mode, dark gray in dark mode
          </div>
        </div>
      </div>
    </div>
  )
}