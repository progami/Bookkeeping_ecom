'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { Moon, Sun, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    console.log(`[ThemeToggle] Changing theme from ${theme} to ${newTheme}`)
    setTheme(newTheme)
  }

  // Avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-lg">
        <div className="p-2 rounded-md bg-slate-700/50 w-9 h-9" />
        <div className="p-2 rounded-md bg-slate-700/50 w-9 h-9" />
        <div className="p-2 rounded-md bg-slate-700/50 w-9 h-9" />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-lg">
      <button
        onClick={() => handleThemeChange('light')}
        className={cn(
          "p-2 rounded-md transition-all",
          theme === 'light' 
            ? "bg-slate-700 text-white" 
            : "text-gray-400 hover:text-white hover:bg-slate-700/50"
        )}
        title="Light theme"
        aria-label="Switch to light theme"
      >
        <Sun className="h-4 w-4" />
      </button>
      
      <button
        onClick={() => handleThemeChange('dark')}
        className={cn(
          "p-2 rounded-md transition-all",
          theme === 'dark' 
            ? "bg-slate-700 text-white" 
            : "text-gray-400 hover:text-white hover:bg-slate-700/50"
        )}
        title="Dark theme"
        aria-label="Switch to dark theme"
      >
        <Moon className="h-4 w-4" />
      </button>
      
      <button
        onClick={() => handleThemeChange('system')}
        className={cn(
          "p-2 rounded-md transition-all",
          theme === 'system' 
            ? "bg-slate-700 text-white" 
            : "text-gray-400 hover:text-white hover:bg-slate-700/50"
        )}
        title="System theme"
        aria-label="Use system theme"
      >
        <Monitor className="h-4 w-4" />
      </button>
    </div>
  )
}