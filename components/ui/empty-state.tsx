'use client'

import { Cloud, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface EmptyStateProps {
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: React.ReactNode
}

export function EmptyState({
  title = 'Connect to Xero',
  description = 'Connect your Xero account to access this feature',
  actionLabel = 'Connect Now',
  onAction,
  icon
}: EmptyStateProps) {
  const router = useRouter()
  
  const handleAction = () => {
    if (onAction) {
      onAction()
    } else {
      window.location.href = '/api/v1/xero/auth'
    }
  }
  
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="mb-6">
          {icon || (
            <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto">
              <Cloud className="h-10 w-10 text-gray-500" />
            </div>
          )}
        </div>
        
        <h2 className="text-2xl font-semibold text-white mb-3">
          {title}
        </h2>
        
        <p className="text-gray-400 mb-8">
          {description}
        </p>
        
        <button
          onClick={handleAction}
          className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all inline-flex items-center gap-2 group"
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  )
}