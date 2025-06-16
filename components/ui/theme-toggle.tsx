'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { Moon, Sun, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex items-center gap-1 p-1 bg-slate-800 rounded-lg">
      <button
        onClick={() => setTheme('light')}
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
        onClick={() => setTheme('dark')}
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
        onClick={() => setTheme('system')}
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