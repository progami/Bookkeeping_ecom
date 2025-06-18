'use client'

/**
 * Enhanced Toast Notification System
 * Categorized notifications with actions and history
 */

import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { typography } from '@/lib/typography'

// Types
export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  action?: ToastAction
  duration?: number
  timestamp: Date
}

// Toast store
class ToastStore {
  private listeners: Set<(toasts: Toast[]) => void> = new Set()
  private toasts: Toast[] = []
  private history: Toast[] = []
  private maxHistory = 50

  subscribe(listener: (toasts: Toast[]) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    this.listeners.forEach(listener => listener([...this.toasts]))
  }

  show(toast: Omit<Toast, 'id' | 'timestamp'>) {
    const newToast: Toast = {
      ...toast,
      id: Math.random().toString(36).substring(2),
      timestamp: new Date(),
      duration: toast.duration ?? 5000
    }

    this.toasts.push(newToast)
    this.history.unshift(newToast)
    
    // Trim history
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(0, this.maxHistory)
    }

    this.notify()

    // Auto-dismiss
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => this.dismiss(newToast.id), newToast.duration)
    }
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id)
    this.notify()
  }

  dismissAll() {
    this.toasts = []
    this.notify()
  }

  getHistory() {
    return [...this.history]
  }

  clearHistory() {
    this.history = []
  }
}

// Global toast store instance
export const toastStore = new ToastStore()

// Toast API
export const toast = {
  success: (title: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'title' | 'timestamp'>>) => {
    toastStore.show({ type: 'success', title, ...options })
  },
  error: (title: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'title' | 'timestamp'>>) => {
    toastStore.show({ type: 'error', title, ...options })
  },
  warning: (title: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'title' | 'timestamp'>>) => {
    toastStore.show({ type: 'warning', title, ...options })
  },
  info: (title: string, options?: Partial<Omit<Toast, 'id' | 'type' | 'title' | 'timestamp'>>) => {
    toastStore.show({ type: 'info', title, ...options })
  },
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((error: any) => string)
    }
  ) => {
    toastStore.show({ 
      type: 'info', 
      title: messages.loading, 
      duration: 0 
    })

    promise
      .then(data => {
        const successMessage = typeof messages.success === 'function' 
          ? messages.success(data) 
          : messages.success
        toastStore.show({ type: 'success', title: successMessage })
      })
      .catch(error => {
        const errorMessage = typeof messages.error === 'function'
          ? messages.error(error)
          : messages.error
        toastStore.show({ type: 'error', title: errorMessage })
      })

    return promise
  }
}

// Toast Component
interface ToastComponentProps {
  toast: Toast
  onDismiss: () => void
}

function ToastComponent({ toast, onDismiss }: ToastComponentProps) {
  const [isExiting, setIsExiting] = useState(false)

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(onDismiss, 200)
  }

  const icons = {
    success: <CheckCircle className="h-5 w-5" />,
    error: <AlertCircle className="h-5 w-5" />,
    warning: <AlertTriangle className="h-5 w-5" />,
    info: <Info className="h-5 w-5" />
  }

  const colors = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400'
  }

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 sm:p-4 rounded-xl border backdrop-blur-sm shadow-lg',
        'transform transition-all duration-200',
        colors[toast.type],
        isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        {icons[toast.type]}
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className={cn(typography.label, 'text-white mb-0')}>
          {toast.title}
        </h4>
        {toast.message && (
          <p className={cn(typography.caption, 'mt-1')}>
            {toast.message}
          </p>
        )}
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className={cn(
              'mt-2 text-sm font-medium hover:underline transition-all',
              toast.type === 'success' && 'text-emerald-400 hover:text-emerald-300',
              toast.type === 'error' && 'text-red-400 hover:text-red-300',
              toast.type === 'warning' && 'text-amber-400 hover:text-amber-300',
              toast.type === 'info' && 'text-blue-400 hover:text-blue-300'
            )}
          >
            {toast.action.label}
          </button>
        )}
      </div>

      <button
        onClick={handleDismiss}
        className="flex-shrink-0 p-1 hover:bg-slate-700/50 rounded-lg transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

// Toast Container
export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const unsubscribe = toastStore.subscribe(setToasts)
    return () => {
      unsubscribe()
    }
  }, [])

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none max-w-md">
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastComponent
            toast={toast}
            onDismiss={() => toastStore.dismiss(toast.id)}
          />
        </div>
      ))}
    </div>
  )
}

// Toast History Component
export function ToastHistory() {
  const [history, setHistory] = useState<Toast[]>([])

  useEffect(() => {
    setHistory(toastStore.getHistory())
  }, [])

  const groupedHistory = history.reduce((acc, toast) => {
    const date = toast.timestamp.toLocaleDateString()
    if (!acc[date]) acc[date] = []
    acc[date].push(toast)
    return acc
  }, {} as Record<string, Toast[]>)

  const typeColors = {
    success: 'text-emerald-400',
    error: 'text-red-400',
    warning: 'text-amber-400',
    info: 'text-blue-400'
  }

  const typeIcons = {
    success: <CheckCircle className="h-4 w-4" />,
    error: <AlertCircle className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    info: <Info className="h-4 w-4" />
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedHistory).map(([date, toasts]) => (
        <div key={date}>
          <h3 className={cn(typography.overline, 'mb-3')}>
            {date}
          </h3>
          <div className="space-y-2">
            {toasts.map(toast => (
              <div
                key={toast.id}
                className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50"
              >
                <div className={cn('flex-shrink-0 mt-0.5', typeColors[toast.type])}>
                  {typeIcons[toast.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className={typography.label}>
                      {toast.title}
                    </h4>
                    <time className={typography.caption}>
                      {toast.timestamp.toLocaleTimeString()}
                    </time>
                  </div>
                  {toast.message && (
                    <p className={cn(typography.caption, 'mt-1')}>
                      {toast.message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      
      {history.length === 0 && (
        <p className={cn(typography.body, 'text-center py-8')}>
          No notification history
        </p>
      )}
    </div>
  )
}