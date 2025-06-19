'use client'

import { Cloud, ArrowRight, CheckCircle, FileText, BarChart3 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ReactNode } from 'react'

interface EmptyStateProps {
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: ReactNode
  steps?: Array<{
    icon: ReactNode
    title: string
    description: string
  }>
  illustration?: 'connection' | 'data' | 'analytics' | 'documents'
}

const illustrations = {
  connection: (
    <div className="relative w-48 h-48 mx-auto mb-8">
      <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-pulse" />
      <div className="absolute inset-4 bg-emerald-500/30 rounded-full animate-pulse animation-delay-150" />
      <div className="absolute inset-8 bg-emerald-500/40 rounded-full animate-pulse animation-delay-300" />
      <div className="relative w-full h-full flex items-center justify-center">
        <Cloud className="h-16 w-16 text-emerald-400" />
      </div>
    </div>
  ),
  data: (
    <div className="relative w-48 h-48 mx-auto mb-8">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="grid grid-cols-3 gap-2">
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className="w-12 h-12 bg-slate-800 rounded-lg animate-pulse"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <FileText className="h-16 w-16 text-blue-400 opacity-80" />
      </div>
    </div>
  ),
  analytics: (
    <div className="relative w-48 h-48 mx-auto mb-8">
      <div className="absolute inset-0 flex items-end justify-center gap-2 px-8">
        {[40, 65, 30, 85, 50].map((height, i) => (
          <div
            key={i}
            className="flex-1 bg-purple-500/30 rounded-t animate-pulse"
            style={{ 
              height: `${height}%`,
              animationDelay: `${i * 100}ms` 
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <BarChart3 className="h-16 w-16 text-purple-400 opacity-80" />
      </div>
    </div>
  ),
  documents: (
    <div className="relative w-48 h-48 mx-auto mb-8">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-32 h-10 bg-cyan-500/20 rounded-lg animate-pulse"
              style={{ 
                animationDelay: `${i * 150}ms`,
                marginLeft: `${i * 8}px`
              }}
            />
          ))}
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <FileText className="h-16 w-16 text-cyan-400 opacity-80" />
      </div>
    </div>
  )
}

export function EmptyState({
  title = 'Connect to Xero',
  description = 'Connect your Xero account to access this feature',
  actionLabel = 'Connect Now',
  onAction,
  icon,
  steps,
  illustration = 'connection'
}: EmptyStateProps) {
  const router = useRouter()
  
  const handleAction = () => {
    if (onAction) {
      onAction()
    } else {
      const currentPath = window.location.pathname
      window.location.href = `/api/v1/xero/auth?returnUrl=${encodeURIComponent(currentPath)}`
    }
  }
  
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="text-center max-w-2xl mx-auto">
        {/* Illustration */}
        {icon || illustrations[illustration]}
        
        {/* Title & Description */}
        <h2 className="text-3xl font-bold text-white mb-4">{title}</h2>
        <p className="text-lg text-slate-300 mb-8 max-w-md mx-auto">{description}</p>
        
        {/* Steps if provided */}
        {steps && steps.length > 0 && (
          <div className="mb-8 max-w-md mx-auto">
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
              How it works
            </h3>
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={index} className="flex items-start gap-4 text-left">
                  <div className="flex-shrink-0 w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                    {step.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-medium mb-1">{step.title}</h4>
                    <p className="text-sm text-slate-400">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Action Button */}
        <button 
          onClick={handleAction}
          className="group px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all inline-flex items-center gap-3 text-lg font-medium shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 animate-pulse"
        >
          <Cloud className="h-6 w-6" />
          {actionLabel}
          <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  )
}