'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  FileText, Activity, TrendingUp, TrendingDown, AlertCircle, 
  BarChart3, ArrowLeft, Zap, Cloud,
  DollarSign, Building2, Receipt, Clock, 
  Wallet, ArrowUpRight, CreditCard, CheckCircle,
  BookOpen, AlertTriangle, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'
import { measurePageLoad } from '@/lib/performance-utils'
import { UnifiedPageHeader } from '@/components/ui/unified-page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { SkeletonMetricCard, SkeletonTransactionList } from '@/components/ui/skeleton'
import { RequireXeroConnection } from '@/components/auth/require-xero-connection'
import { pageConfigs } from '@/lib/page-configs'

interface FinancialOverview {
  cashInBank: number
  balanceSheet: {
    totalAssets: number
    totalLiabilities: number
    netAssets: number
  }
  profitLoss: {
    revenue: number
    expenses: number
    netProfit: number
  }
  vatLiability: number
  netCashFlow: number
  periodComparison: {
    revenueChange: number
    profitChange: number
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

export default function BookkeepingDashboard() {
  // Measure page performance
  if (typeof window !== 'undefined') {
    measurePageLoad('Bookkeeping Dashboard');
  }
  const router = useRouter()
  const searchParams = useSearchParams()
  const { 
    hasData, 
    hasActiveToken, 
    organization, 
    lastSync,
    isLoading: authLoading,
    isSyncing,
    connectToXero,
    syncData,
    checkAuthStatus 
  } = useAuth()
  
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('30d')

  useEffect(() => {
    // Check for OAuth callback params
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    
    if (connected === 'true') {
      toast.success('Successfully connected to Xero!')
      // Re-check auth status to update the UI
      checkAuthStatus()
    } else if (error) {
      toast.error(`Failed to connect to Xero: ${error}`)
    }
  }, [searchParams])

  useEffect(() => {
    // Only fetch dashboard data if we have data in the database
    if (hasData && !authLoading) {
      fetchDashboardData()
    } else if (!authLoading) {
      setDataLoading(false)
    }
  }, [hasData, authLoading, timeRange])

  const fetchDashboardData = async () => {
    try {
      setDataLoading(true)
      
      // Fetch multiple data sources in parallel with cache headers
      // Use live API endpoints when connected to Xero
      const [balanceSheetRes, plRes, vatRes, statsResponse, accountsResponse] = await Promise.all([
        fetch(hasActiveToken ? '/api/v1/xero/reports/balance-sheet-live' : '/api/v1/xero/reports/balance-sheet', {
          headers: { 'Cache-Control': 'max-age=300' }
        }),
        fetch(hasActiveToken ? `/api/v1/xero/reports/profit-loss-live?timeRange=${timeRange}` : '/api/v1/xero/reports/profit-loss', {
          headers: { 'Cache-Control': 'max-age=300' }
        }),
        fetch(hasActiveToken ? '/api/v1/xero/reports/vat-liability-live' : '/api/v1/xero/reports/vat-liability', {
          headers: { 'Cache-Control': 'max-age=600' }
        }),
        fetch('/api/v1/bookkeeping/stats', {
          headers: { 'Cache-Control': 'max-age=60' }
        }),
        fetch('/api/v1/bookkeeping/bank-accounts', {
          headers: { 'Cache-Control': 'max-age=180' }
        })
      ])

      const balanceSheetData = balanceSheetRes.ok ? await balanceSheetRes.json() : null
      const plData = plRes.ok ? await plRes.json() : null
      const vatData = vatRes.ok ? await vatRes.json() : null
      const statsData = statsResponse.ok ? await statsResponse.json() : null
      const accountsData = accountsResponse.ok ? await accountsResponse.json() : null

      // Transform and combine data
      setStats({
        financial: {
          // Use cash from Xero balance sheet if available (when connected), otherwise calculate from local DB
          cashInBank: balanceSheetData?.cashInBank || 
                     accountsData?.accounts?.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0) || 0,
          balanceSheet: {
            totalAssets: balanceSheetData?.totalAssets || 0,
            totalLiabilities: balanceSheetData?.totalLiabilities || 0,
            netAssets: balanceSheetData?.netAssets || 0
          },
          profitLoss: {
            revenue: plData?.revenue || 0,
            expenses: plData?.expenses || 0,
            netProfit: plData?.netProfit || 0
          },
          vatLiability: vatData?.currentLiability || vatData?.netAmount || 0,
          netCashFlow: (plData?.revenue || 0) - (plData?.expenses || 0),
          periodComparison: {
            revenueChange: plData?.revenueChange || 0,
            profitChange: plData?.profitChange || 0
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
        recentTransactions: statsData?.recentTransactions || []
      })
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setDataLoading(false)
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Show loading while auth is checking
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-emerald-500/20 rounded-full animate-pulse" />
          <div className="absolute inset-0 w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <RequireXeroConnection pageConfig={pageConfigs.bookkeeping}>
      <div className="min-h-screen bg-slate-950">
        <div className="container mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <UnifiedPageHeader 
          title="Bookkeeping Dashboard"
          description="Manage your financial records and transactions"
          showAuthStatus={true}
          showTimeRangeSelector={true}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        />

        {/* Content based on state */}
        {!hasData && hasActiveToken ? (
          <EmptyState 
            title="Initial Setup Required"
            description="Your Xero account is connected. Click below to sync your data for the first time."
            actionLabel={isSyncing ? "Syncing Data..." : "Start Initial Sync"}
            onAction={syncData}
            icon={
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                <RefreshCw className={`h-10 w-10 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
              </div>
            }
          />
        ) : dataLoading ? (
        /* Loading dashboard data */
        <div className="space-y-8">
          {/* Financial Overview Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <SkeletonMetricCard key={i} />
            ))}
          </div>
          
          {/* Bank Accounts Skeleton */}
          <SkeletonTransactionList />
          
          {/* Transactions Skeleton */}
          <SkeletonTransactionList />
        </div>
      ) : (
        <>


          {/* Financial Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {/* Rest of the dashboard content remains the same */}
            {/* Cash in Bank */}
            <div className="group relative overflow-hidden bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6 hover:border-emerald-500/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-emerald-500/20 rounded-xl">
                    <Building2 className="h-6 w-6 text-emerald-400" />
                  </div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Total</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-white">
                  {formatCurrency(stats?.financial.cashInBank || 0)}
                </div>
                <p className="text-sm text-gray-400 mt-2">Cash in Bank</p>
              </div>
            </div>

            {/* Balance Sheet */}
            <div className="group relative overflow-hidden bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6 hover:border-blue-500/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-500/20 rounded-xl">
                    <FileText className="h-6 w-6 text-blue-400" />
                  </div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Today</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-white">
                  {formatCurrency(stats?.financial.balanceSheet.netAssets || 0)}
                </div>
                <div className="text-sm text-gray-400 mt-1">Net Assets</div>
                <div className="text-xs text-gray-500 mt-2">
                  Assets: {formatCurrency(stats?.financial.balanceSheet.totalAssets || 0)}
                </div>
              </div>
            </div>

            {/* P&L Statement */}
            <div className="group relative overflow-hidden bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6 hover:border-green-500/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-green-500/20 rounded-xl">
                    <BarChart3 className="h-6 w-6 text-green-400" />
                  </div>
                  <span className={`text-xs font-medium ${
                    (stats?.financial.periodComparison.profitChange ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {(stats?.financial.periodComparison.profitChange ?? 0) >= 0 ? '+' : ''}
                    {(stats?.financial.periodComparison.profitChange ?? 0).toFixed(1)}%
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-white">
                  {formatCurrency(stats?.financial.profitLoss.netProfit || 0)}
                </div>
                <div className="text-sm text-gray-400 mt-1">Net Profit ({timeRange})</div>
                <div className="text-xs text-gray-500 mt-2">
                  Revenue: {formatCurrency(stats?.financial.profitLoss.revenue || 0)}
                </div>
              </div>
            </div>

            {/* VAT Liability */}
            <div className="group relative overflow-hidden bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6 hover:border-amber-500/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-amber-500/20 rounded-xl">
                    <Receipt className="h-6 w-6 text-amber-400" />
                  </div>
                  <Activity className="h-4 w-4 text-gray-400" />
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-white">
                  {formatCurrency(stats?.financial.vatLiability || 0)}
                </div>
                <div className="text-sm text-gray-400 mt-1">VAT Liability</div>
                <div className="text-xs text-gray-500 mt-2">
                  As of today
                </div>
              </div>
            </div>
          </div>

          {/* Main Bookkeeping Apps */}
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">Bookkeeping Tools</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* SOP Generator */}
              <button
                onClick={() => router.push('/bookkeeping/sop-generator')}
                className="group relative overflow-hidden bg-gradient-to-br from-emerald-600/20 to-cyan-600/20 border border-emerald-500/30 rounded-2xl p-4 sm:p-6 hover:border-emerald-500 transition-all duration-300 text-left"
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
                className="group relative overflow-hidden bg-gradient-to-br from-purple-600/20 to-pink-600/20 border border-purple-500/30 rounded-2xl p-4 sm:p-6 hover:border-purple-500 transition-all duration-300 text-left"
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
                className="group relative overflow-hidden bg-gradient-to-br from-cyan-600/20 to-teal-600/20 border border-cyan-500/30 rounded-2xl p-4 sm:p-6 hover:border-cyan-500 transition-all duration-300 text-left"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
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
                className="group relative overflow-hidden bg-gradient-to-br from-amber-600/20 to-orange-600/20 border border-amber-500/30 rounded-2xl p-4 sm:p-6 hover:border-amber-500 transition-all duration-300 text-left"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
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
              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6">
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
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6">
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
                      <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No recent transactions</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Reconciliation Status */}
            <div className="space-y-6">
              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 sm:p-6">
                <h2 className="text-xl font-semibold text-white mb-6">Reconciliation</h2>
                
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl sm:text-4xl font-bold text-white mb-2">
                      {stats?.reconciliation.totalUnreconciled || 0}
                    </div>
                    <p className="text-sm text-gray-400">Unreconciled Transactions</p>
                  </div>
                  
                  <div className="h-px bg-slate-700" />
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Reconciliation Rate</span>
                      <span className="text-sm font-medium text-white">
                        {stats?.reconciliation.reconciliationRate || 0}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Needs Attention</span>
                      <span className="text-sm font-medium text-amber-400">
                        {stats?.reconciliation.needsAttention || 0} accounts
                      </span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => router.push('/bookkeeping/transactions')}
                    className="w-full py-3 bg-purple-600/20 text-purple-400 rounded-xl hover:bg-purple-600/30 transition-colors flex items-center justify-center gap-2 border border-purple-500/30"
                  >
                    <Activity className="h-4 w-4" />
                    Start Reconciling
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
        </div>
      </div>
    </RequireXeroConnection>
  )
}