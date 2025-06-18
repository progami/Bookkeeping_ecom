'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { universalLogger } from '@/lib/universal-logger'

type Theme = 'dark' // Force dark mode only

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'dark' // Always dark
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [resolvedTheme, setResolvedTheme] = useState<'dark'>('dark')
  const [mounted, setMounted] = useState(false)

  const setTheme = (newTheme: Theme) => {
    universalLogger.info('[ThemeContext] Dark mode only - ignoring theme change request')
    // Always force dark mode
    setThemeState('dark')
  }

  useEffect(() => {
    setMounted(true)
    // Always use dark theme
    setThemeState('dark')
    localStorage.setItem('theme', 'dark')
  }, [])

  useEffect(() => {
    if (!mounted) return
    
    universalLogger.info('[ThemeContext] Applying dark theme only')
    
    // Apply theme to both html and body for compatibility
    const root = window.document.documentElement
    const body = window.document.body
    
    // Remove light class and ensure dark class
    root.classList.remove('light')
    root.classList.add('dark')
    if (body) {
      body.classList.remove('light')
      body.classList.add('dark')
    }
    
    setResolvedTheme('dark')
    
    // Save to localStorage
    localStorage.setItem('theme', 'dark')
    
    universalLogger.info('[ThemeContext] Dark theme applied')
  }, [mounted])

  // No need to listen for system theme changes - always dark

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}