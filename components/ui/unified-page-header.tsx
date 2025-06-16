'use client'

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, RefreshCw, Cloud, LogOut, Clock
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { Breadcrumbs } from './breadcrumbs'
import { responsiveText } from '@/lib/responsive-utils'

interface UnifiedPageHeaderProps {
  // Basic props (from page-header)
  title: string
  description?: string
  actions?: ReactNode
  
  // Back navigation (from module-header)
  showBackButton?: boolean
  backTo?: string
  backLabel?: string
  
  // Auth and sync features (from standard-page-header)
  showAuthStatus?: boolean
  showTimeRangeSelector?: boolean
  timeRange?: string
  onTimeRangeChange?: (value: string) => void
  
  // Breadcrumbs
  showBreadcrumbs?: boolean
  breadcrumbItems?: Array<{ label: string; href?: string }>
  
  // Additional customization
  className?: string
}

export function UnifiedPageHeader({ 
  title, 
  description, 
  actions,
  showBackButton = false,
  backTo = '/finance', 
  backLabel = 'Back to Finance',
  showAuthStatus = false,
  showTimeRangeSelector = false,
  timeRange = '30d',
  onTimeRangeChange,
  showBreadcrumbs = true,
  breadcrumbItems,
  className
}: UnifiedPageHeaderProps) {
  const router = useRouter()
  const { 
    hasActiveToken, 
    organization, 
    lastSync,
    isSyncing,
    syncData,
    disconnectFromXero
  } = useAuth()

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  const getRealTimeSubtitle = () => {
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-GB', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    })
    const timeStr = now.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit'
    })
    return `${dateStr} at ${timeStr}`
  }

  return (
    <div className={cn("mb-8", className)}>
      {showBreadcrumbs && <Breadcrumbs items={breadcrumbItems} />}
      
      {showBackButton && (
        <button
          onClick={() => router.push(backTo)}
          className="text-gray-400 hover:text-white transition-colors mb-4 inline-flex items-center group"
        >
          <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          {backLabel}
        </button>
      )}
      
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex-1">
          <h1 className={cn(responsiveText.heading[1], "font-bold text-white mb-2")}>
            {title}
          </h1>
          <div className="flex items-center gap-4 text-gray-400">
            {description && <p>{description}</p>}
            {showAuthStatus && hasActiveToken && (
              <>
                <span>•</span>
                <span className="text-sm">{getRealTimeSubtitle()}</span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          {showTimeRangeSelector && onTimeRangeChange && (
            <select
              value={timeRange}
              onChange={(e) => onTimeRangeChange(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="365d">Last 365 days</option>
            </select>
          )}
          
          {showAuthStatus && (
            <>
              {hasActiveToken ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-900/20 border border-emerald-700/50 rounded-lg">
                    <Cloud className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm text-emerald-400">
                      {organization?.tenantName || 'Connected'}
                    </span>
                  </div>
                  
                  <button
                    onClick={syncData}
                    disabled={isSyncing}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all",
                      "bg-slate-800 hover:bg-slate-700 border border-slate-700",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    <RefreshCw className={cn(
                      "h-4 w-4",
                      isSyncing && "animate-spin"
                    )} />
                    <span className="text-sm">
                      {isSyncing ? 'Syncing...' : `Sync (${formatDate(lastSync)})`}
                    </span>
                  </button>
                  
                  <button
                    onClick={disconnectFromXero}
                    className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Disconnect from Xero"
                  >
                    <LogOut className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => router.push('/login')}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all"
                >
                  <Cloud className="h-4 w-4" />
                  Connect to Xero
                </button>
              )}
            </>
          )}
          
          {actions}
        </div>
      </div>
    </div>
  )
}