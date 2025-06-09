'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, FileText, Settings, Activity, TrendingUp, TrendingDown, AlertCircle, CheckCircle, BarChart3, Calendar, Filter, Download, ArrowLeft, Zap, Database, Cloud, LogOut, Upload } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { ImportDialog } from '@/components/import-dialog'

interface Stats {
  totalRules: number
  activeRules: number
  inactiveRules: number
  recentActivity: Array<{
    id: string
    type: string
    ruleName: string
    timestamp: string
  }>
  systemStatus: {
    xeroConnected: boolean
    lastSync: string | null
    automationEnabled: boolean
  }
}

interface XeroStatus {
  connected: boolean
  organization: {
    tenantId: string
    tenantName: string
    tenantType: string
  } | null
}

export default function BookkeepingDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [stats, setStats] = useState<Stats | null>(null)
  const [xeroStatus, setXeroStatus] = useState<XeroStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7d')
  const [disconnecting, setDisconnecting] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)

  useEffect(() => {
    // Check for OAuth callback params
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    
    if (connected === 'true') {
      toast.success('Successfully connected to Xero!')
    } else if (error) {
      toast.error(`Failed to connect to Xero: ${error}`)
    }
    
    fetchStats()
    checkXeroStatus()
  }, [searchParams])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/v1/bookkeeping/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkXeroStatus = async () => {
    try {
      const response = await fetch('/api/v1/xero/status')
      if (response.ok) {
        const data = await response.json()
        setXeroStatus(data)
        
        // Update stats with Xero connection status
        setStats(prev => prev ? {
          ...prev,
          systemStatus: {
            ...prev.systemStatus,
            xeroConnected: data.connected
          }
        } : null)
      }
    } catch (error) {
      console.error('Error checking Xero status:', error)
    }
  }

  const handleConnectXero = () => {
    window.location.href = '/api/v1/xero/auth'
  }

  const handleDisconnectXero = async () => {
    if (!confirm('Are you sure you want to disconnect from Xero?')) {
      return
    }
    
    setDisconnecting(true)
    try {
      const response = await fetch('/api/v1/xero/disconnect', {
        method: 'POST'
      })
      
      if (response.ok) {
        toast.success('Disconnected from Xero')
        setXeroStatus({ connected: false, organization: null })
        setStats(prev => prev ? {
          ...prev,
          systemStatus: {
            ...prev.systemStatus,
            xeroConnected: false
          }
        } : null)
      } else {
        toast.error('Failed to disconnect from Xero')
      }
    } catch (error) {
      console.error('Error disconnecting:', error)
      toast.error('Failed to disconnect from Xero')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/')}
          className="text-gray-400 hover:text-white transition-colors mb-4 inline-flex items-center"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Bookkeeping Dashboard
            </h1>
            <p className="text-gray-400">
              Intelligent financial categorization and automation
            </p>
          </div>
          <div className="flex gap-3">
            {!xeroStatus?.connected && (
              <button 
                onClick={handleConnectXero}
                className="px-4 py-2 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30 transition-colors"
              >
                <Cloud className="h-4 w-4 inline mr-2" />
                Connect Xero
              </button>
            )}
            <button 
              onClick={() => setShowImportDialog(true)}
              className="px-4 py-2 bg-cyan-600/20 text-cyan-400 rounded-lg hover:bg-cyan-600/30 transition-colors"
            >
              <Upload className="h-4 w-4 inline mr-2" />
              Import SOPs
            </button>
            <button className="px-4 py-2 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/30 transition-colors">
              <Download className="h-4 w-4 inline mr-2" />
              Export Report
            </button>
            <select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 bg-slate-800/50 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-emerald-500/20 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      ) : (
        <>
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="group relative overflow-hidden bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-emerald-500/50 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-500/20 rounded-xl">
                  <FileText className="h-6 w-6 text-emerald-400" />
                </div>
                <span className="text-xs text-gray-500 uppercase tracking-wider">Total</span>
              </div>
              <div className="text-3xl font-bold text-white" data-testid="total-rules">{stats?.totalRules || 0}</div>
              <div className="text-sm text-gray-400 mt-1">Categorization Rules</div>
            </div>
          </div>

          <div className="group relative overflow-hidden bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-cyan-500/50 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-cyan-500/20 rounded-xl">
                  <CheckCircle className="h-6 w-6 text-cyan-400" />
                </div>
                <span className="text-xs text-gray-500 uppercase tracking-wider">Active</span>
              </div>
              <div className="text-3xl font-bold text-white" data-testid="active-rules">{stats?.activeRules || 0}</div>
              <div className="text-sm text-gray-400 mt-1">Active Rules</div>
            </div>
          </div>

          <div className="group relative overflow-hidden bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-amber-500/50 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-amber-500/20 rounded-xl">
                  <AlertCircle className="h-6 w-6 text-amber-400" />
                </div>
                <span className="text-xs text-gray-500 uppercase tracking-wider">Inactive</span>
              </div>
              <div className="text-3xl font-bold text-white" data-testid="inactive-rules">{stats?.inactiveRules || 0}</div>
              <div className="text-sm text-gray-400 mt-1">Inactive Rules</div>
            </div>
          </div>

          <div className="group relative overflow-hidden bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-purple-500/50 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-500/20 rounded-xl">
                  <BarChart3 className="h-6 w-6 text-purple-400" />
                </div>
                <span className="text-xs text-gray-500 uppercase tracking-wider">This Month</span>
              </div>
              <div className="text-3xl font-bold text-white">0</div>
              <div className="text-sm text-gray-400 mt-1">Processed Transactions</div>
              <div className="mt-3 text-xs text-purple-400">
                <Calendar className="h-3 w-3 inline mr-1" />
                No data yet
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Quick Actions */}
          <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6" data-testid="quick-actions">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
              <div className="w-1 h-6 bg-emerald-500 rounded-full mr-3" />
              Quick Actions
            </h2>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/bookkeeping/rules/new')}
                className="w-full px-4 py-3 bg-emerald-600/20 text-emerald-400 rounded-xl hover:bg-emerald-600/30 transition-all duration-200 flex items-center justify-center group"
              >
                <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform" />
                Create New Rule
              </button>
              <button
                onClick={() => router.push('/bookkeeping/rules')}
                className="w-full px-4 py-3 bg-slate-700/50 text-gray-300 rounded-xl hover:bg-slate-700/70 hover:text-white transition-all duration-200 flex items-center justify-center"
              >
                <FileText className="h-4 w-4 mr-2" />
                View All Rules
              </button>
              <button
                onClick={() => router.push('/bookkeeping/import')}
                className="w-full px-4 py-3 bg-slate-700/50 text-gray-300 rounded-xl hover:bg-slate-700/70 hover:text-white transition-all duration-200 flex items-center justify-center"
              >
                <Download className="h-4 w-4 mr-2" />
                Import Rules
              </button>
              <button
                onClick={() => router.push('/bookkeeping/test')}
                className="w-full px-4 py-3 bg-slate-700/50 text-gray-300 rounded-xl hover:bg-slate-700/70 hover:text-white transition-all duration-200 flex items-center justify-center"
              >
                <Filter className="h-4 w-4 mr-2" />
                Test Rules
              </button>
              {xeroStatus?.connected && (
                <button
                  onClick={() => router.push('/bookkeeping/transactions')}
                  className="w-full px-4 py-3 bg-cyan-600/20 text-cyan-400 rounded-xl hover:bg-cyan-600/30 transition-all duration-200 flex items-center justify-center"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Transactions
                </button>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6" data-testid="recent-activity">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
              <div className="w-1 h-6 bg-cyan-500 rounded-full mr-3" />
              Recent Activity
            </h2>
            {stats?.recentActivity && stats.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {stats.recentActivity.map((activity, index) => (
                  <div key={activity.id} className="group flex items-center justify-between p-3 bg-slate-900/50 rounded-xl hover:bg-slate-900/70 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                          <Activity className="h-4 w-4 text-emerald-400" />
                        </div>
                        {index === 0 && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm text-white group-hover:text-emerald-400 transition-colors">
                          {activity.ruleName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {activity.type === 'rule_created' ? 'Rule created' : activity.type}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* System Status */}
        <div className="mt-8 bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6" data-testid="system-status">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
            <div className="w-1 h-6 bg-purple-500 rounded-full mr-3" />
            System Status
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  {xeroStatus?.connected ? (
                    <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-red-400" />
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium text-white">Xero Connection</div>
                    <div className="text-xs text-gray-500">
                      {xeroStatus?.connected ? 'Connected' : 'Not Connected'}
                    </div>
                    {xeroStatus?.organization && (
                      <div className="text-xs text-gray-400 mt-1">
                        Organization: {xeroStatus.organization.tenantName}
                      </div>
                    )}
                  </div>
                </div>
                {xeroStatus?.connected && (
                  <button
                    onClick={handleDisconnectXero}
                    disabled={disconnecting}
                    className="px-3 py-1 text-xs bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors flex items-center gap-1"
                  >
                    <LogOut className="h-3 w-3" />
                    {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                )}
              </div>
              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full ${xeroStatus?.connected ? 'bg-green-500' : 'bg-red-500'} rounded-full`} style={{width: xeroStatus?.connected ? '100%' : '0%'}} />
              </div>
            </div>
            
            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                  <Zap className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Automation</div>
                  <div className="text-xs text-gray-500">
                    {stats?.systemStatus?.automationEnabled ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
              </div>
              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full ${stats?.systemStatus?.automationEnabled ? 'bg-cyan-500' : 'bg-gray-500'} rounded-full`} style={{width: stats?.systemStatus?.automationEnabled ? '100%' : '0%'}} />
              </div>
            </div>
            
            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Cloud className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">Last Sync</div>
                  <div className="text-xs text-gray-500">
                    {stats?.systemStatus?.lastSync 
                      ? new Date(stats.systemStatus.lastSync).toLocaleDateString()
                      : 'Never'
                    }
                  </div>
                </div>
              </div>
              <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{width: stats?.systemStatus?.lastSync ? '100%' : '0%'}} />
              </div>
            </div>
          </div>
        </div>
      </>
      )}
      
      {/* Import Dialog */}
      {showImportDialog && (
        <ImportDialog 
          onClose={() => setShowImportDialog(false)}
          onImportComplete={() => {
            fetchStats()
            toast.success('Rules imported successfully')
          }}
        />
      )}
      
      <Toaster position="top-right" />
    </div>
  )
}