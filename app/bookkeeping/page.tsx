'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  FileText, Activity, TrendingUp, TrendingDown, AlertCircle, 
  BarChart3, ArrowLeft, Zap, Cloud, LogOut, Upload,
  DollarSign, Building2, RefreshCw, Receipt, Clock, 
  Wallet, ArrowUpRight, CreditCard, CheckCircle, X,
  BookOpen, AlertTriangle
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

interface FinancialOverview {
  cashInBank: number
  monthlyIncome: number
  monthlyExpenses: number
  netCashFlow: number
  periodComparison: {
    incomeChange: number
    expenseChange: number
  }
}

interface BankAccount {
  id: string
  name: string
  currency: string
  balance: number
  unreconciledCount: number
  lastUpdated: string
}

interface DashboardStats {
  financial: FinancialOverview
  bankAccounts: BankAccount[]
  reconciliation: {
    totalUnreconciled: number
    needsAttention: number
    reconciliationRate: number
  }
  recentTransactions: Array<{
    id: string
    date: string
    description: string
    amount: number
    type: 'SPEND' | 'RECEIVE'
    status: 'reconciled' | 'unreconciled'
    bankAccount: string
  }>
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
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [xeroStatus, setXeroStatus] = useState<XeroStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [timeRange, setTimeRange] = useState('30d')
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    // Check for OAuth callback params
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    
    if (connected === 'true') {
      toast.success('Successfully connected to Xero!')
    } else if (error) {
      toast.error(`Failed to connect to Xero: ${error}`)
    }
    
    fetchDashboardData()
    checkXeroStatus()
  }, [searchParams, timeRange])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch multiple data sources in parallel
      const [analyticsResponse, statsResponse, accountsResponse] = await Promise.all([
        fetch(`/api/v1/bookkeeping/analytics?period=${timeRange === '7d' ? 'week' : timeRange === '30d' ? 'month' : 'quarter'}`),
        fetch('/api/v1/bookkeeping/stats'),
        fetch('/api/v1/bookkeeping/bank-accounts')
      ])

      const analyticsData = analyticsResponse.ok ? await analyticsResponse.json() : null
      const statsData = statsResponse.ok ? await statsResponse.json() : null
      const accountsData = accountsResponse.ok ? await accountsResponse.json() : null

      // Transform and combine data
      setStats({
        financial: {
          cashInBank: accountsData?.accounts?.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0) || 0,
          monthlyIncome: analyticsData?.summary?.totalIncome || 0,
          monthlyExpenses: analyticsData?.summary?.totalExpenses || 0,
          netCashFlow: analyticsData?.summary?.netAmount || 0,
          periodComparison: {
            incomeChange: analyticsData?.trends?.incomeGrowth || 0,
            expenseChange: analyticsData?.trends?.expenseGrowth || 0
          }
        },
        bankAccounts: accountsData?.accounts?.map((acc: any) => ({
          id: acc.id,
          name: acc.name,
          currency: acc.currencyCode || 'GBP',
          balance: acc.balance || 0,
          unreconciledCount: acc.unreconciledTransactions || 0,
          lastUpdated: acc.lastSynced || new Date().toISOString()
        })) || [],
        reconciliation: {
          totalUnreconciled: accountsData?.totalUnreconciled || 0,
          needsAttention: accountsData?.accounts?.filter((acc: any) => acc.unreconciledTransactions > 10).length || 0,
          reconciliationRate: accountsData?.reconciliationRate || 0
        },
        recentTransactions: analyticsData?.recentTransactions || []
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      toast.error('Failed to load dashboard data')
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
      }
    } catch (error) {
      console.error('Error checking Xero status:', error)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      // Sync bank balances first
      const balanceResponse = await fetch('/api/v1/xero/sync-bank-balances', { method: 'POST' })
      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json()
        toast.success(`Updated ${balanceData.accounts?.length || 0} bank account balances`)
      }
      
      // Then sync transactions
      const response = await fetch('/api/v1/xero/sync-all-fixed', { method: 'POST' })
      if (response.ok) {
        toast.success('Sync completed successfully')
        fetchDashboardData()
      } else {
        toast.error('Sync failed')
      }
    } catch (error) {
      toast.error('Failed to sync with Xero')
    } finally {
      setSyncing(false)
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
      const response = await fetch('/api/v1/xero/disconnect', { method: 'POST' })
      
      if (response.ok) {
        toast.success('Disconnected from Xero')
        setXeroStatus({ connected: false, organization: null })
        fetchDashboardData()
      } else {
        toast.error('Failed to disconnect from Xero')
      }
    } catch (error) {
      toast.error('Failed to disconnect from Xero')
    } finally {
      setDisconnecting(false)
    }
  }

  const formatCurrency = (amount: number, currency = 'GBP') => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
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
            <h1 className="text-4xl font-bold text-white mb-2">Bookkeeping Dashboard</h1>
            <p className="text-gray-400">
              {xeroStatus?.connected 
                ? `Connected to ${xeroStatus.organization?.tenantName}` 
                : 'Connect to Xero to get started'}
            </p>
          </div>
          
          <div className="flex gap-3">
            {!xeroStatus?.connected ? (
              <button 
                onClick={handleConnectXero}
                className="px-4 py-2 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30 transition-colors"
              >
                <Cloud className="h-4 w-4 inline mr-2" />
                Connect Xero
              </button>
            ) : (
              <>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="px-4 py-2 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/30 transition-colors flex items-center"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Transactions'}
                </button>
                <button
                  onClick={() => router.push('/bookkeeping/analytics')}
                  className="px-4 py-2 bg-indigo-600/20 text-indigo-400 rounded-lg hover:bg-indigo-600/30 transition-colors"
                >
                  <BarChart3 className="h-4 w-4 inline mr-2" />
                  Analytics
                </button>
              </>
            )}
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
      ) : !xeroStatus?.connected ? (
        /* Connect to Xero CTA */
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-12 text-center">
          <Cloud className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-white mb-2">Connect to Xero</h2>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Connect your Xero account to sync bank transactions, manage reconciliations, and automate your bookkeeping workflow.
          </p>
          <button 
            onClick={handleConnectXero}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Cloud className="h-5 w-5 inline mr-2" />
            Connect Xero Account
          </button>
        </div>
      ) : (
        <>
          {/* Financial Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {/* Cash in Bank */}
            <div className="group relative overflow-hidden bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-emerald-500/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-emerald-500/20 rounded-xl">
                    <Building2 className="h-6 w-6 text-emerald-400" />
                  </div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Total</span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {formatCurrency(stats?.financial.cashInBank || 0)}
                </div>
                <div className="text-sm text-gray-400 mt-1">Cash in Bank</div>
              </div>
            </div>

            {/* Monthly Income */}
            <div className="group relative overflow-hidden bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-green-500/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-green-500/20 rounded-xl">
                    <TrendingUp className="h-6 w-6 text-green-400" />
                  </div>
                  <span className={`text-xs font-medium ${
                    (stats?.financial.periodComparison.incomeChange ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {(stats?.financial.periodComparison.incomeChange ?? 0) >= 0 ? '+' : ''}
                    {(stats?.financial.periodComparison.incomeChange ?? 0).toFixed(1)}%
                  </span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {formatCurrency(stats?.financial.monthlyIncome || 0)}
                </div>
                <div className="text-sm text-gray-400 mt-1">Income ({timeRange})</div>
              </div>
            </div>

            {/* Monthly Expenses */}
            <div className="group relative overflow-hidden bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-red-500/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-red-500/20 rounded-xl">
                    <TrendingDown className="h-6 w-6 text-red-400" />
                  </div>
                  <span className={`text-xs font-medium ${
                    (stats?.financial.periodComparison.expenseChange ?? 0) <= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {(stats?.financial.periodComparison.expenseChange ?? 0) >= 0 ? '+' : ''}
                    {(stats?.financial.periodComparison.expenseChange ?? 0).toFixed(1)}%
                  </span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {formatCurrency(stats?.financial.monthlyExpenses || 0)}
                </div>
                <div className="text-sm text-gray-400 mt-1">Expenses ({timeRange})</div>
              </div>
            </div>

            {/* Net Cash Flow */}
            <div className="group relative overflow-hidden bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-cyan-500/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-cyan-500/20 rounded-xl">
                    <Wallet className="h-6 w-6 text-cyan-400" />
                  </div>
                  <Activity className="h-4 w-4 text-gray-400" />
                </div>
                <div className={`text-3xl font-bold ${
                  (stats?.financial.netCashFlow ?? 0) >= 0 ? 'text-white' : 'text-red-400'
                }`}>
                  {formatCurrency(stats?.financial.netCashFlow || 0)}
                </div>
                <div className="text-sm text-gray-400 mt-1">Net Cash Flow</div>
              </div>
            </div>
          </div>

          {/* Main Bookkeeping Apps */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">Bookkeeping Tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* SOP Generator */}
              <button
                onClick={() => router.push('/bookkeeping/sop-generator')}
                className="group relative overflow-hidden bg-gradient-to-br from-emerald-600/20 to-cyan-600/20 border border-emerald-500/30 rounded-2xl p-6 hover:border-emerald-500 transition-all duration-300 text-left"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-emerald-500/20 rounded-xl">
                      <Zap className="h-8 w-8 text-emerald-400 group-hover:animate-pulse" />
                    </div>
                    <span className="px-2 py-1 bg-emerald-500/20 rounded text-xs text-emerald-400 font-medium">NEW</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">SOP Generator</h3>
                  <p className="text-sm text-gray-400 line-clamp-2">
                    Generate Standard Operating Procedure codes for Xero transactions
                  </p>
                </div>
              </button>

              {/* All Transactions */}
              <button
                onClick={() => router.push('/bookkeeping/transactions')}
                className="group relative overflow-hidden bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-2xl p-6 hover:border-purple-500 transition-all duration-300 text-left"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-purple-500/20 rounded-xl">
                      <Receipt className="h-8 w-8 text-purple-400" />
                    </div>
                    {(stats?.reconciliation.totalUnreconciled ?? 0) > 0 && (
                      <span className="px-2 py-1 bg-amber-500/20 rounded text-xs text-amber-400 font-medium">
                        {stats?.reconciliation.totalUnreconciled} new
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Transactions</h3>
                  <p className="text-sm text-gray-400 line-clamp-2">
                    View, reconcile and categorize all bank transactions
                  </p>
                </div>
              </button>


              {/* SOP Tables */}
              <button
                onClick={() => router.push('/bookkeeping/sop-tables')}
                className="group relative overflow-hidden bg-gradient-to-br from-cyan-600/20 to-teal-600/20 border border-cyan-500/30 rounded-2xl p-6 hover:border-cyan-500 transition-all duration-300 text-left"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="mb-4">
                    <div className="p-3 bg-cyan-500/20 rounded-xl">
                      <FileText className="h-8 w-8 text-cyan-400" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">SOP Tables</h3>
                  <p className="text-sm text-gray-400 line-clamp-2">
                    View complete Standard Operating Procedure reference tables
                  </p>
                </div>
              </button>
              
              {/* Chart of Accounts */}
              <button
                onClick={() => router.push('/bookkeeping/chart-of-accounts')}
                className="group relative overflow-hidden bg-gradient-to-br from-amber-600/20 to-orange-600/20 border border-amber-500/30 rounded-2xl p-6 hover:border-amber-500 transition-all duration-300 text-left"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="mb-4">
                    <div className="p-3 bg-amber-500/20 rounded-xl">
                      <BookOpen className="h-8 w-8 text-amber-400" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Chart of Accounts</h3>
                  <p className="text-sm text-gray-400 line-clamp-2">
                    View and sync GL accounts from Xero
                  </p>
                </div>
              </button>
            </div>
          </div>


          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Bank Accounts */}
            <div className="lg:col-span-2 space-y-6">
              {/* Bank Accounts Section */}
              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white flex items-center">
                    <div className="w-1 h-6 bg-cyan-500 rounded-full mr-3" />
                    Bank Accounts
                  </h2>
                  <span className="text-sm text-gray-400">
                    {stats?.bankAccounts.length || 0} accounts
                  </span>
                </div>
                
                <div className="space-y-4">
                  {stats?.bankAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="p-4 bg-slate-900/50 rounded-xl hover:bg-slate-900/70 transition-colors cursor-pointer"
                      onClick={() => router.push('/bookkeeping/transactions')}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-3">
                            <CreditCard className="h-5 w-5 text-gray-400" />
                            <div>
                              <h3 className="font-medium text-white">{account.name}</h3>
                              <p className="text-sm text-gray-400">
                                {account.unreconciledCount > 0 ? (
                                  <span className="text-amber-400">
                                    {account.unreconciledCount} unreconciled
                                  </span>
                                ) : (
                                  <span className="text-green-400">All reconciled</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-white">
                            {formatCurrency(account.balance, account.currency)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Updated {new Date(account.lastUpdated).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {(!stats?.bankAccounts || stats.bankAccounts.length === 0) && (
                    <div className="text-center py-8 text-gray-400">
                      <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No bank accounts found</p>
                      <button 
                        onClick={handleSync}
                        className="mt-2 text-emerald-400 hover:text-emerald-300"
                      >
                        Sync from Xero
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-white flex items-center">
                    <div className="w-1 h-6 bg-purple-500 rounded-full mr-3" />
                    Recent Transactions
                  </h2>
                  <button
                    onClick={() => router.push('/bookkeeping/transactions')}
                    className="text-sm text-purple-400 hover:text-purple-300"
                  >
                    View all →
                  </button>
                </div>
                
                <div className="space-y-3">
                  {stats?.recentTransactions?.slice(0, 5).map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl hover:bg-slate-900/70 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          transaction.type === 'RECEIVE' 
                            ? 'bg-green-500/20' 
                            : 'bg-red-500/20'
                        }`}>
                          {transaction.type === 'RECEIVE' ? (
                            <TrendingUp className="h-4 w-4 text-green-400" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {transaction.description}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(transaction.date).toLocaleDateString()} • {transaction.bankAccount}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-medium ${
                          transaction.type === 'RECEIVE' 
                            ? 'text-green-400' 
                            : 'text-red-400'
                        }`}>
                          {transaction.type === 'RECEIVE' ? '+' : '-'}
                          {formatCurrency(Math.abs(transaction.amount))}
                        </div>
                        <div className="text-xs text-gray-500">
                          {transaction.status === 'reconciled' ? (
                            <span className="text-green-400">✓</span>
                          ) : (
                            <span className="text-amber-400">Pending</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {(!stats?.recentTransactions || stats.recentTransactions.length === 0) && (
                    <div className="text-center py-8 text-gray-400">
                      <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No recent transactions</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Reconciliation Status */}
              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
                  <div className="w-1 h-6 bg-amber-500 rounded-full mr-3" />
                  Reconciliation
                </h2>
                
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-white mb-2">
                      {stats?.reconciliation.totalUnreconciled || 0}
                    </div>
                    <p className="text-sm text-gray-400">Unreconciled Transactions</p>
                  </div>
                  
                  {(stats?.reconciliation.totalUnreconciled ?? 0) > 0 && (
                    <>
                      <div className="h-px bg-slate-700" />
                      <div className="space-y-3">
                        {(stats?.reconciliation.needsAttention ?? 0) > 0 && (
                          <div className="flex items-center justify-between p-3 bg-amber-500/10 rounded-lg">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-amber-400" />
                              <span className="text-sm text-amber-400">Needs Attention</span>
                            </div>
                            <span className="text-sm font-medium text-amber-400">
                              {stats?.reconciliation.needsAttention} accounts
                            </span>
                          </div>
                        )}
                        <button
                          onClick={() => router.push('/bookkeeping/transactions?filter=unreconciled')}
                          className="w-full px-4 py-3 bg-amber-600/20 text-amber-400 rounded-xl hover:bg-amber-600/30 transition-all"
                        >
                          <CheckCircle className="h-4 w-4 inline mr-2" />
                          Start Reconciling
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>


              {/* Automation Status */}
              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
                  <div className="w-1 h-6 bg-indigo-500 rounded-full mr-3" />
                  Automation
                </h2>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Active Rules</span>
                    <span className="text-sm font-medium text-white">
                      {stats?.automation.activeRules || 0} / {stats?.automation.totalRules || 0}
                    </span>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-400">Match Rate</span>
                      <span className="text-sm font-medium text-white">
                        {stats?.automation.matchRate || 0}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div 
                        className="bg-indigo-500 h-2 rounded-full transition-all"
                        style={{ width: `${stats?.automation.matchRate || 0}%` }}
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={() => router.push('/bookkeeping/rules')}
                    className="w-full text-sm text-indigo-400 hover:text-indigo-300"
                  >
                    Configure Rules →
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Xero Connection Status */}
          <div className="mt-8 bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/20 rounded-xl">
                  <Cloud className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Xero Connection</h3>
                  <p className="text-sm text-gray-400">
                    Connected to {xeroStatus?.organization?.tenantName}
                  </p>
                </div>
              </div>
              <button
                onClick={handleDisconnectXero}
                disabled={disconnecting}
                className="px-4 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>
        </>
      )}
      
    </div>
  )
}