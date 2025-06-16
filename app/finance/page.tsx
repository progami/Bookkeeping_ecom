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
import { BackButton } from '@/components/ui/back-button'
import { PageHeader } from '@/components/ui/page-header'
import { ModuleHeader } from '@/components/ui/module-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { StandardPageHeader } from '@/components/ui/standard-page-header'
import { formatNumber } from '@/lib/design-tokens'
import { HelpTooltip, ContextualHelp } from '@/components/ui/tooltip'

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
  const [metrics, setMetrics] = useState<FinanceMetrics | null>(null)
  const [moduleStatus, setModuleStatus] = useState<ModuleStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [timeRange, setTimeRange] = useState('30d')

  useEffect(() => {
    // Check for OAuth callback params
    const handleOAuthCallback = async () => {
      const connected = searchParams.get('connected')
      const error = searchParams.get('error')
      
      if (connected === 'true') {
        toast.success('Successfully connected to Xero!')
        // Re-check auth status to update the UI
        await checkAuthStatus()
        // Fetch finance data after successful connection
        fetchFinanceData()
        // Remove query params from URL
        window.history.replaceState({}, document.title, '/finance')
      } else if (error) {
        toast.error(`Failed to connect to Xero: ${error}`)
        window.history.replaceState({}, document.title, '/finance')
      }
    }
    
    handleOAuthCallback()
  }, [searchParams, checkAuthStatus])

  useEffect(() => {
    // Only fetch data if we're connected
    if (hasActiveToken) {
      fetchFinanceData()
    } else {
      // Clear loading state if not connected
      setLoading(false)
    }
  }, [timeRange, hasActiveToken])

  const fetchFinanceData = async () => {
    try {
      setLoading(true)
      
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
    if (score >= 50) return 'text-amber-400'
    return 'text-red-400'
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Toaster position="top-right" />
      <div className="container mx-auto px-4 py-8">
        
        {/* Enhanced Header */}
        <StandardPageHeader 
          title="Financial Overview"
          subtitle="Real-time financial intelligence powered by Xero"
          showBackButton={false}
          showTimeRangeSelector={true}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        />

        {!hasActiveToken ? (
          <EmptyState 
            title="Welcome to Your Financial Hub"
            description="Connect your Xero account to unlock real-time financial insights, automated bookkeeping, and powerful analytics."
            actionLabel="Get Started with Xero"
            steps={[
              {
                icon: <Shield className="h-5 w-5 text-emerald-400" />,
                title: "Secure Connection",
                description: "OAuth 2.0 authentication with bank-level security"
              },
              {
                icon: <Activity className="h-5 w-5 text-blue-400" />,
                title: "Real-time Sync",
                description: "Automatic data synchronization every 30 minutes"
              },
              {
                icon: <BarChart3 className="h-5 w-5 text-purple-400" />,
                title: "Instant Insights",
                description: "Financial analytics and reporting at your fingertips"
              }
            ]}
          />
        ) : (
          <>
            {/* Remove the warning since we now show empty state when not connected */}
            
            {/* Financial Health Score Card */}
            <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-3xl p-8 mb-8">
              <div className="flex items-center justify-between flex-wrap gap-6">
                <div>
                  <h2 className="text-2xl font-semibold text-white mb-2 flex items-center gap-2">
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
                    <span className={`text-6xl font-bold ${getHealthColor(moduleStatus?.cashFlow.healthScore || 0)}`}>
                      {moduleStatus?.cashFlow.healthScore || 0}
                    </span>
                    <span className="text-2xl text-gray-400">/100</span>
                  </div>
                  <p className="text-gray-400 mt-2">
                    Based on cash reserves, profit margins, and liquidity ratios
                  </p>
                </div>
                
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white">
                      {metrics?.quickRatio.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-400 flex items-center justify-center gap-1">
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
                    <div className="text-sm text-gray-400 flex items-center justify-center gap-1">
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
                    <div className="text-sm text-gray-400 flex items-center justify-center gap-1">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
              {/* Cash Balance - Most Important */}
              <div className="relative bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-blue-500/20 rounded-xl">
                    <Wallet className="h-6 w-6 text-blue-400" />
                  </div>
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Total</span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {formatCurrency(metrics?.cashBalance || 0)}
                </div>
                <div className="text-sm text-gray-400 mt-1">Cash Balance</div>
                <div className="text-xs text-gray-500 mt-2">
                  Forecast: {formatCurrency(moduleStatus?.cashFlow.forecast30Day || 0)}
                </div>
              </div>

              {/* Revenue */}
              <div className="relative bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-emerald-500/20 rounded-xl">
                    <TrendingUp className="h-6 w-6 text-emerald-400" />
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
                <div className="text-sm text-gray-400 mt-1">Total Revenue</div>
                <div className="text-xs text-gray-500 mt-2">
                  Receivables: {formatCurrency(metrics?.accountsReceivable || 0)}
                </div>
              </div>

              {/* Expenses */}
              <div className="relative bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
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
                <div className="text-sm text-gray-400 mt-1">Total Expenses</div>
                <div className="text-xs text-gray-500 mt-2">
                  Payables: {formatCurrency(metrics?.accountsPayable || 0)}
                </div>
              </div>

              {/* Net Income */}
              <div className="relative bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
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
                <div className="text-sm text-gray-400 mt-1">Net Profit</div>
                <div className="text-xs text-gray-500 mt-2">
                  Daily avg: {formatCurrency((metrics?.netIncome || 0) / 30)}
                </div>
              </div>
            </div>

            {/* Active Modules Section - Better Organization */}
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <Shield className="h-6 w-6 mr-3 text-emerald-400" />
              Financial Modules
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
              {/* Bookkeeping - PRIMARY MODULE (Larger) */}
              <div 
                className="group relative bg-gradient-to-br from-emerald-900/20 to-emerald-800/20 backdrop-blur-sm border-2 border-emerald-600/50 rounded-2xl p-8 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/20 transition-all cursor-pointer transform hover:-translate-y-1 lg:col-span-2 xl:col-span-1"
                onClick={() => router.push('/bookkeeping')}
                onMouseEnter={() => {
                  // Prefetch data for bookkeeping module on hover
                  import('@/lib/performance-utils').then(({ prefetchSubModuleData }) => {
                    prefetchSubModuleData('bookkeeping');
                  });
                }}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all" />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="p-4 bg-emerald-500/20 rounded-xl">
                        <BookOpen className="h-8 w-8 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-semibold text-white">Bookkeeping</h3>
                        <p className="text-base text-slate-300">Core accounting & reconciliation</p>
                      </div>
                    </div>
                    <ArrowUpRight className="h-6 w-6 text-emerald-400 transition-all group-hover:translate-x-1 group-hover:-translate-y-1" />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-white">{moduleStatus?.bookkeeping.unreconciledCount || 0}</div>
                      <div className="text-xs text-gray-400">Unreconciled</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          hasActiveToken ? 'bg-green-400' : 'bg-gray-400'
                        }`} />
                        <span className="text-sm text-white">Xero</span>
                      </div>
                      <div className="text-xs text-gray-400">{hasActiveToken ? 'Connected' : 'Not Connected'}</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-sm font-medium text-white">3</div>
                      <div className="text-xs text-gray-400">Reports</div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">Balance Sheet</span>
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">P&L Statement</span>
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">VAT Reports</span>
                  </div>
                </div>
              </div>

              {/* Cash Flow - Active */}
              <div 
                className="group relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 transition-all cursor-pointer transform hover:-translate-y-1"
                onClick={() => router.push('/cashflow')}
                onMouseEnter={() => {
                  // Prefetch data for cashflow module on hover
                  import('@/lib/performance-utils').then(({ prefetchSubModuleData }) => {
                    prefetchSubModuleData('cashflow');
                  });
                }}
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
                        <p className="text-sm text-gray-400">90-day forecasting & planning</p>
                      </div>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-gray-400 group-hover:text-cyan-400 transition-colors" />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className={`text-2xl font-bold ${getHealthColor(moduleStatus?.cashFlow.healthScore || 0)}`}>
                        {moduleStatus?.cashFlow.healthScore || 0}%
                      </div>
                      <div className="text-xs text-gray-400">Health</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-sm font-medium text-white">90d</div>
                      <div className="text-xs text-gray-400">Forecast</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-sm font-medium text-white">Active</div>
                      <div className="text-xs text-gray-400">Status</div>
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
                className="group relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all cursor-pointer transform hover:-translate-y-1"
                onClick={() => router.push('/analytics')}
                onMouseEnter={() => {
                  // Prefetch data for analytics module on hover
                  import('@/lib/performance-utils').then(({ prefetchSubModuleData }) => {
                    prefetchSubModuleData('analytics');
                  });
                }}
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
                        <p className="text-sm text-gray-400">Business intelligence & insights</p>
                      </div>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-white">{moduleStatus?.analytics.vendorCount || 0}</div>
                      <div className="text-xs text-gray-400">Vendors</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-sm font-medium text-white truncate">
                        {moduleStatus?.analytics.topVendor || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-400">Top Vendor</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-sm font-medium text-white">Live</div>
                      <div className="text-xs text-gray-400">Data</div>
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