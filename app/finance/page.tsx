'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  TrendingUp, TrendingDown, DollarSign, BarChart3, 
  FileText, Wallet, Calculator, ArrowUpRight, ArrowDownRight,
  Building2, Clock, AlertCircle, CheckCircle, Activity,
  Receipt, CreditCard, PieChart, Target, ArrowLeft,
  RefreshCw, Shield, BookOpen, LineChart, Database, LogOut, Cloud
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { MetricCard } from '@/components/ui/metric-card'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { SkeletonDashboard } from '@/components/ui/skeleton'
import { BackButton } from '@/components/ui/back-button'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useSync } from '@/contexts/SyncContext'
import { useXeroData } from '@/hooks/use-xero-data'
import { UnifiedPageHeader } from '@/components/ui/unified-page-header'
import { formatNumber } from '@/lib/design-tokens'
import { HelpTooltip, ContextualHelp } from '@/components/ui/tooltip'
import { responsiveText } from '@/lib/responsive-utils'
import { cn } from '@/lib/utils'
import { gridLayouts } from '@/lib/grid-utils'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface FinanceMetrics {
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  cashBalance: number
  accountsReceivable: number
  accountsPayable: number
  revenueGrowth: number
  expenseGrowth: number
  profitMargin: number
  quickRatio: number
  cashFlowTrend: 'positive' | 'negative' | 'neutral'
  upcomingPayments: number
  overdueInvoices: number
}

interface ModuleStatus {
  bookkeeping: {
    unreconciledCount: number
    lastSync: string | null
    syncStatus: 'connected' | 'disconnected' | 'error'
  }
  cashFlow: {
    forecast30Day: number
    criticalDate: string | null
    healthScore: number
  }
  analytics: {
    vendorCount: number
    topVendor: string | null
  }
}


export default function FinanceDashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { 
    hasData, 
    hasActiveToken, 
    organization, 
    lastSync,
    isSyncing,
    syncData,
    disconnectFromXero,
    checkAuthStatus 
  } = useAuth()
  const { syncStatus, canUseXeroData } = useSync()
  const { fetchXeroData, canFetchData, hasError } = useXeroData({
    onSyncRequired: () => {
      toast.info('Loading your financial data...')
    },
    onSyncFailed: (error) => {
      toast.error(error?.message || 'Unable to load financial data')
    }
  })
  const [metrics, setMetrics] = useState<FinanceMetrics | null>(null)
  const [moduleStatus, setModuleStatus] = useState<ModuleStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [timeRange, setTimeRange] = useState('30d')

  useEffect(() => {
    // Check for OAuth callback params - this should no longer happen
    // as we've updated the flow to go through /sync
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    
    if (connected === 'true') {
      // This is legacy behavior - clean it up
      window.history.replaceState({}, document.title, '/finance')
      // The sync should have already happened via /sync page
    } else if (error) {
      toast.error(`Failed to connect to Xero: ${error}`)
      window.history.replaceState({}, document.title, '/finance')
    }
  }, [searchParams])

  useEffect(() => {
    // New, correct logic
    if (canFetchData) {
      fetchFinanceData()
    } else {
      setLoading(false)
    }
  }, [timeRange, canFetchData])

  const fetchFinanceData = async () => {
    try {
      setLoading(true)
      
      // Use fetchXeroData wrapper to respect sync status
      const data = await fetchXeroData(async () => {
        // Fetch real data from Xero APIs with caching headers
        const [balanceSheetRes, plRes, cashBalanceRes, vendorsRes] = await Promise.all([
          fetch('/api/v1/xero/reports/balance-sheet', {
            headers: { 'Cache-Control': 'max-age=300' } // 5 min cache
          }),
          fetch('/api/v1/xero/reports/profit-loss', {
            headers: { 'Cache-Control': 'max-age=300' } // 5 min cache
          }),
          fetch('/api/v1/bookkeeping/cash-balance', {
            headers: { 'Cache-Control': 'max-age=60' } // 1 min cache
          }),
          fetch('/api/v1/analytics/top-vendors', {
            headers: { 'Cache-Control': 'max-age=600' } // 10 min cache
          })
        ])

        const balanceSheet = balanceSheetRes.ok ? await balanceSheetRes.json() : null
        const profitLoss = plRes.ok ? await plRes.json() : null
        const cashBalance = cashBalanceRes.ok ? await cashBalanceRes.json() : null
        const vendorsData = vendorsRes.ok ? await vendorsRes.json() : null
        
        return { balanceSheet, profitLoss, cashBalance, vendorsData }
      })
      
      if (!data) {
        // Sync failed or not ready
        setMetrics(null)
        return
      }
      
      const { balanceSheet, profitLoss, cashBalance, vendorsData } = data

      // Extract real financial metrics
      const revenue = profitLoss?.totalRevenue || 0
      const expenses = profitLoss?.totalExpenses || 0
      const netIncome = profitLoss?.netProfit || 0
      const totalCash = cashBalance?.totalBalance || 0
      const currentAssets = balanceSheet?.currentAssets || 0
      const currentLiabilities = balanceSheet?.currentLiabilities || 0
      
      setMetrics({
        totalRevenue: revenue,
        totalExpenses: expenses,
        netIncome: netIncome,
        cashBalance: totalCash,
        accountsReceivable: balanceSheet?.accountsReceivable || 0,
        accountsPayable: balanceSheet?.accountsPayable || 0,
        revenueGrowth: 0, // Will calculate from historical data
        expenseGrowth: 0,
        profitMargin: revenue > 0 ? (netIncome / revenue) * 100 : 0,
        quickRatio: currentLiabilities > 0 ? (currentAssets - (balanceSheet?.inventory || 0)) / currentLiabilities : 0,
        cashFlowTrend: netIncome >= 0 ? 'positive' : 'negative',
        upcomingPayments: 0, // Will fetch from bills
        overdueInvoices: 0 // Will fetch from invoices
      })

      setModuleStatus({
        bookkeeping: {
          unreconciledCount: 0, // Will fetch from transactions
          lastSync: new Date().toISOString(),
          syncStatus: hasActiveToken ? 'connected' : 'disconnected'
        },
        cashFlow: {
          forecast30Day: totalCash + (netIncome * 30 / 365), // Simple projection
          criticalDate: null,
          healthScore: totalCash > expenses * 3 ? 100 : Math.round((totalCash / (expenses * 3)) * 100)
        },
        analytics: {
          vendorCount: vendorsData?.vendorCount || 0,
          topVendor: vendorsData?.topVendors?.[0]?.name || null
        }
      })
    } catch (error) {
      console.error('Error fetching finance data:', error)
      toast.error('Failed to load finance data')
    } finally {
      setLoading(false)
    }
  }


  const formatCurrency = (amount: number) => {
    return formatNumber(amount, { currency: true, decimals: 0, abbreviate: true })
  }

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 50) return 'text-brand-amber'
    return 'text-red-400'
  }

  return (
    <div className="min-h-screen bg-slate-950">
        <Toaster position="top-right" />
        <div className="container mx-auto px-4 py-6 sm:py-8">
          
          {/* Enhanced Header */}
          <UnifiedPageHeader 
            title="Financial Overview"
            description="Real-time financial intelligence powered by Xero"
            showBackButton={false}
            showAuthStatus={true}
            showTimeRangeSelector={true}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />

          {/* Show sync error if sync failed */}
          {syncStatus.status === 'failed' && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Unable to load data from Xero. {syncStatus.error?.message}
                {syncStatus.error?.retryable && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => router.push('/sync')}
                    className="ml-2"
                  >
                    Retry Sync
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {loading && hasActiveToken && syncStatus.status !== 'failed' ? (
            <SkeletonDashboard />
          ) : (
          <>
            {/* Remove the warning since we now show empty state when not connected */}
            
            {/* Financial Health Score Card */}
            <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-3xl p-6 sm:p-8 mb-8">
              <div className="flex items-center justify-between flex-wrap gap-6">
                <div>
                  <h2 className={cn(responsiveText.heading[2], "font-semibold text-white mb-2 flex items-center gap-2")}>
                    Financial Health Score
                    <ContextualHelp
                      title="Financial Health Score"
                      description="A comprehensive metric that evaluates your business's financial wellbeing based on multiple factors."
                      tips={[
                        "Score above 80: Excellent financial health",
                        "Score 60-80: Good health with room for improvement",
                        "Score below 60: Requires attention to financial management"
                      ]}
                      learnMoreUrl="#"
                    />
                  </h2>
                  <div className="flex items-baseline gap-3">
                    <span className={cn(
                      responsiveText.display[2], 
                      "font-bold",
                      getHealthColor(moduleStatus?.cashFlow.healthScore || 0)
                    )}>
                      {moduleStatus?.cashFlow.healthScore || 0}
                    </span>
                    <span className={cn(responsiveText.heading[3], "text-tertiary")}>/100</span>
                  </div>
                  <p className="text-tertiary mt-2">
                    Based on cash reserves, profit margins, and liquidity ratios
                  </p>
                </div>
                
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white">
                      {metrics?.quickRatio.toFixed(2)}
                    </div>
                    <div className="text-sm text-tertiary flex items-center justify-center gap-1">
                      Quick Ratio
                      <HelpTooltip 
                        content="Measures ability to pay short-term obligations with liquid assets. A ratio > 1.0 is generally good."
                        size="sm"
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white">
                      {metrics?.profitMargin.toFixed(1)}%
                    </div>
                    <div className="text-sm text-tertiary flex items-center justify-center gap-1">
                      Profit Margin
                      <HelpTooltip 
                        content="Percentage of revenue that becomes profit. Higher margins indicate better cost control."
                        size="sm"
                      />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className={`text-3xl font-bold capitalize ${
                      metrics?.cashFlowTrend === 'positive' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {metrics?.cashFlowTrend}
                    </div>
                    <div className="text-sm text-tertiary flex items-center justify-center gap-1">
                      Cash Flow
                      <HelpTooltip 
                        content="Direction of cash movement. Positive means more cash coming in than going out."
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Financial Metrics - Non-clickable info cards */}
            <div className={cn(gridLayouts.cards.metrics, "mb-8")}>
              {/* Cash Balance - Most Important */}
              <div className="relative bg-slate-800/30 border border-default rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-brand-blue rounded-xl">
                    <Wallet className="h-6 w-6 text-brand-blue" />
                  </div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Total</span>
                </div>
                <div className={cn(responsiveText.metric.medium, "font-bold text-white")}>
                  {formatCurrency(metrics?.cashBalance || 0)}
                </div>
                <div className="text-sm text-tertiary mt-1">Cash Balance</div>
                <div className="text-xs text-gray-500 mt-2">
                  Forecast: {formatCurrency(moduleStatus?.cashFlow.forecast30Day || 0)}
                </div>
              </div>

              {/* Revenue */}
              <div className="relative bg-slate-800/30 border border-default rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-brand-emerald/20 rounded-xl">
                    <TrendingUp className="h-6 w-6 text-brand-emerald" />
                  </div>
                  <span className={`text-xs font-medium ${
                    (metrics?.revenueGrowth ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatPercentage(metrics?.revenueGrowth || 0)}
                  </span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {formatCurrency(metrics?.totalRevenue || 0)}
                </div>
                <div className="text-sm text-tertiary mt-1">Total Revenue</div>
                <div className="text-xs text-gray-500 mt-2">
                  Receivables: {formatCurrency(metrics?.accountsReceivable || 0)}
                </div>
              </div>

              {/* Expenses */}
              <div className="relative bg-slate-800/30 border border-default rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-red-500/20 rounded-xl">
                    <TrendingDown className="h-6 w-6 text-red-400" />
                  </div>
                  <span className={`text-xs font-medium ${
                    (metrics?.expenseGrowth ?? 0) <= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatPercentage(metrics?.expenseGrowth || 0)}
                  </span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {formatCurrency(metrics?.totalExpenses || 0)}
                </div>
                <div className="text-sm text-tertiary mt-1">Total Expenses</div>
                <div className="text-xs text-gray-500 mt-2">
                  Payables: {formatCurrency(metrics?.accountsPayable || 0)}
                </div>
              </div>

              {/* Net Income */}
              <div className="relative bg-slate-800/30 border border-default rounded-2xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-cyan-500/20 rounded-xl">
                    <Activity className="h-6 w-6 text-cyan-400" />
                  </div>
                  <span className="text-xs font-medium text-gray-500">
                    {metrics?.profitMargin.toFixed(1)}% margin
                  </span>
                </div>
                <div className={`text-3xl font-bold ${
                  (metrics?.netIncome ?? 0) >= 0 ? 'text-white' : 'text-red-400'
                }`}>
                  {formatCurrency(metrics?.netIncome || 0)}
                </div>
                <div className="text-sm text-tertiary mt-1">Net Profit</div>
                <div className="text-xs text-gray-500 mt-2">
                  Daily avg: {formatCurrency((metrics?.netIncome || 0) / 30)}
                </div>
              </div>
            </div>

            {/* Active Modules Section - Better Organization */}
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Shield className="h-6 w-6 mr-3 text-brand-emerald" />
              Financial Modules
            </h2>
            
            <div className={cn(gridLayouts.cards.modules, "mb-8")}>
              {/* Bookkeeping - PRIMARY MODULE */}
              <div 
                className="group relative bg-secondary backdrop-blur-sm border border-default rounded-2xl p-4 sm:p-6 hover:border-brand-emerald hover:shadow-lg hover:shadow-brand-emerald/10 transition-all cursor-pointer transform hover:-translate-y-1"
                onClick={() => router.push('/bookkeeping')}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-emerald/10 rounded-full blur-3xl group-hover:bg-brand-emerald/20 transition-all" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-brand-emerald/20 rounded-xl">
                        <BookOpen className="h-6 w-6 text-brand-emerald" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white">Bookkeeping</h3>
                        <p className="text-sm text-tertiary">Core accounting & reconciliation</p>
                      </div>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-tertiary group-hover:text-brand-emerald transition-colors" />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-primary rounded-lg p-3">
                      <div className="text-2xl font-bold text-white">{moduleStatus?.bookkeeping.unreconciledCount || 0}</div>
                      <div className="text-xs text-tertiary">Unreconciled</div>
                    </div>
                    <div className="bg-primary rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          hasActiveToken ? 'bg-brand-emerald' : 'bg-gray-400'
                        }`} />
                        <span className="text-sm text-white">Xero</span>
                      </div>
                      <div className="text-xs text-tertiary">{hasActiveToken ? 'Connected' : 'Not Connected'}</div>
                    </div>
                    <div className="bg-primary rounded-lg p-3">
                      <div className="text-sm font-medium text-white">3</div>
                      <div className="text-xs text-tertiary">Reports</div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-brand-emerald/20 text-brand-emerald rounded text-xs">Balance Sheet</span>
                    <span className="px-2 py-1 bg-brand-emerald/20 text-brand-emerald rounded text-xs">P&L Statement</span>
                    <span className="px-2 py-1 bg-brand-emerald/20 text-brand-emerald rounded text-xs">VAT Reports</span>
                  </div>
                </div>
              </div>

              {/* Cash Flow - Active */}
              <div 
                className="group relative bg-secondary backdrop-blur-sm border border-default rounded-2xl p-4 sm:p-6 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 transition-all cursor-pointer transform hover:-translate-y-1"
                onClick={() => router.push('/cashflow')}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/20 transition-all" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-cyan-500/20 rounded-xl">
                        <LineChart className="h-6 w-6 text-cyan-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white">Cash Flow</h3>
                        <p className="text-sm text-tertiary">90-day forecasting & planning</p>
                      </div>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-tertiary group-hover:text-cyan-400 transition-colors" />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-primary rounded-lg p-3">
                      <div className={`text-2xl font-bold ${getHealthColor(moduleStatus?.cashFlow.healthScore || 0)}`}>
                        {moduleStatus?.cashFlow.healthScore || 0}%
                      </div>
                      <div className="text-xs text-tertiary">Health</div>
                    </div>
                    <div className="bg-primary rounded-lg p-3">
                      <div className="text-sm font-medium text-white">90d</div>
                      <div className="text-xs text-tertiary">Forecast</div>
                    </div>
                    <div className="bg-primary rounded-lg p-3">
                      <div className="text-sm font-medium text-white">Active</div>
                      <div className="text-xs text-tertiary">Status</div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs">Forecasting</span>
                    <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs">Scenarios</span>
                    <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs">Tax Planning</span>
                  </div>
                </div>
              </div>

              {/* Business Analytics */}
              <div 
                className="group relative bg-secondary backdrop-blur-sm border border-default rounded-2xl p-4 sm:p-6 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all cursor-pointer transform hover:-translate-y-1"
                onClick={() => router.push('/analytics')}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-indigo-500/20 rounded-xl">
                        <BarChart3 className="h-6 w-6 text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white">Analytics</h3>
                        <p className="text-sm text-tertiary">Business intelligence & insights</p>
                      </div>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-tertiary group-hover:text-indigo-400 transition-colors" />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-primary rounded-lg p-3">
                      <div className="text-2xl font-bold text-white">{moduleStatus?.analytics.vendorCount || 0}</div>
                      <div className="text-xs text-tertiary">Vendors</div>
                    </div>
                    <div className="bg-primary rounded-lg p-3">
                      <div className="text-sm font-medium text-white truncate">
                        {moduleStatus?.analytics.topVendor || 'N/A'}
                      </div>
                      <div className="text-xs text-tertiary">Top Vendor</div>
                    </div>
                    <div className="bg-primary rounded-lg p-3">
                      <div className="text-sm font-medium text-white">Live</div>
                      <div className="text-xs text-tertiary">Data</div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded text-xs">Vendor Analysis</span>
                    <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded text-xs">Spend Trends</span>
                    <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded text-xs">KPIs</span>
                  </div>
                </div>
              </div>
            </div>

          </>
        )}
        </div>
    </div>
  )
}