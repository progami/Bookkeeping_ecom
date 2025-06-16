'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark')
  const [mounted, setMounted] = useState(false)

  const setTheme = (newTheme: Theme) => {
    console.log('[ThemeContext] setTheme called with:', newTheme)
    setThemeState(newTheme)
  }

  useEffect(() => {
    setMounted(true)
    // Get theme from localStorage or default to dark
    const savedTheme = localStorage.getItem('theme') as Theme
    console.log('[ThemeContext] Initial load, saved theme:', savedTheme)
    if (savedTheme) {
      setThemeState(savedTheme)
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    
    console.log('[ThemeContext] Applying theme:', theme)
    
    // Apply theme to both html and body for compatibility
    const root = window.document.documentElement
    const body = window.document.body
    
    // Remove both classes first
    root.classList.remove('light', 'dark')
    if (body) {
      body.classList.remove('light', 'dark')
    }
    
    // Determine resolved theme
    let resolved: 'light' | 'dark' = 'dark'
    
    if (theme === 'system') {
      // Check system preference
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      resolved = systemTheme
    } else {
      resolved = theme as 'light' | 'dark'
    }
    
    console.log('[ThemeContext] Resolved theme:', resolved)
    
    // Apply the theme
    root.classList.add(resolved)
    if (body) {
      body.classList.add(resolved)
    }
    setResolvedTheme(resolved)
    
    // Save to localStorage
    localStorage.setItem('theme', theme)
    
    console.log('[ThemeContext] Theme applied. HTML classes:', root.className, 'Body classes:', body?.className)
  }, [theme, mounted])

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const systemTheme = mediaQuery.matches ? 'dark' : 'light'
      setResolvedTheme(systemTheme)
      
      const root = window.document.documentElement
      const body = window.document.body
      root.classList.remove('light', 'dark')
      root.classList.add(systemTheme)
      if (body) {
        body.classList.remove('light', 'dark')
        body.classList.add(systemTheme)
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

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