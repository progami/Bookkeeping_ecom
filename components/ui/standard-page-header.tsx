'use client'

import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, RefreshCw, Cloud, LogOut, 
  Database, Clock
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface StandardPageHeaderProps {
  title: string
  subtitle?: string
  showBackButton?: boolean
  backTo?: string
  backLabel?: string
  additionalActions?: ReactNode
  showTimeRangeSelector?: boolean
  timeRange?: string
  onTimeRangeChange?: (value: string) => void
}

export function StandardPageHeader({ 
  title, 
  subtitle, 
  showBackButton = false,
  backTo = '/finance', 
  backLabel = 'Back to Finance',
  additionalActions,
  showTimeRangeSelector = true,
  timeRange = '30d',
  onTimeRangeChange
}: StandardPageHeaderProps) {
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
  
  return (
    <div className="mb-8">
      {showBackButton && (
        <button
          onClick={() => router.push(backTo)}
          className="text-gray-400 hover:text-white transition-colors mb-4 inline-flex items-center group"
        >
          <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          {backLabel}
        </button>
      )}
      
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">
            {title}
          </h1>
          {subtitle && (
            <p className="text-gray-400">{subtitle}</p>
          )}
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          {/* Connection Status */}
          {hasActiveToken && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="text-sm text-gray-400">
                {organization?.tenantName || 'Connected to Xero'}
              </span>
            </div>
          )}
          
          {/* Last Sync Time */}
          {lastSync && (
            <div className="text-sm text-gray-400 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Last sync: {formatDate(lastSync)}
            </div>
          )}
          
          {/* Refresh button - always visible when connected */}
          {hasActiveToken && (
            <button 
              onClick={syncData}
              disabled={isSyncing}
              className="px-4 py-2 bg-slate-800/50 text-gray-300 rounded-lg hover:bg-slate-800/70 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-slate-700"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Refresh'}
            </button>
          )}
          
          {/* Connect/Disconnect toggle button */}
          <button 
            key={`auth-toggle-${hasActiveToken}`}
            onClick={async () => {
              if (hasActiveToken) {
                // Disconnect flow
                if (confirm('This will disconnect your Xero account. You\'ll need to reconnect to sync data. Continue?')) {
                  await disconnectFromXero();
                }
              } else {
                // Connect flow
                window.location.href = '/api/v1/xero/auth';
              }
            }}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
              hasActiveToken 
                ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30' 
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {hasActiveToken ? (
              <>
                <LogOut className="h-4 w-4" />
                Disconnect
              </>
            ) : (
              <>
                <Cloud className="h-4 w-4" />
                Connect to Xero
              </>
            )}
          </button>
          
          {/* Additional custom actions */}
          {additionalActions}
          
          {/* DB Schema button */}
          <button
            onClick={() => router.push('/database-schema')}
            className="px-3 py-2 bg-slate-800/50 text-gray-400 rounded-lg border border-slate-700 hover:border-slate-600 hover:text-white transition-all flex items-center gap-2"
            title="View Database Schema"
          >
            <Database className="h-4 w-4" />
            <span className="text-sm">DB Schema</span>
          </button>
          
          {/* Time Range Selector */}
          {showTimeRangeSelector && onTimeRangeChange && (
            <select 
              value={timeRange}
              onChange={(e) => onTimeRangeChange(e.target.value)}
              className="px-4 py-2 bg-slate-800/50 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="ytd">Year to Date</option>
            </select>
          )}
        </div>
      </div>
    </div>
  )
}