'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  TrendingUp, TrendingDown, DollarSign, BarChart3, 
  FileText, Wallet, Calculator, ArrowUpRight, ArrowDownRight,
  Building2, Clock, AlertCircle, CheckCircle, Activity,
  Receipt, CreditCard, PieChart, Target, ArrowLeft
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

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
  reporting: {
    scheduledReports: number
    lastReportDate: string | null
  }
  budget: {
    utilizationRate: number
    varianceAlerts: number
  }
}

export default function FinanceDashboard() {
  const router = useRouter()
  const [metrics, setMetrics] = useState<FinanceMetrics | null>(null)
  const [moduleStatus, setModuleStatus] = useState<ModuleStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('30d')

  useEffect(() => {
    fetchFinanceData()
  }, [timeRange])

  const fetchFinanceData = async () => {
    try {
      setLoading(true)
      
      // Fetch data from various sources
      const [analyticsResponse, statsResponse, accountsResponse, insightsResponse] = await Promise.all([
        fetch(`/api/v1/bookkeeping/analytics?period=${timeRange === '7d' ? 'week' : timeRange === '30d' ? 'month' : 'quarter'}`),
        fetch('/api/v1/bookkeeping/stats'),
        fetch('/api/v1/xero/accounts'),
        fetch('/api/v1/bookkeeping/insights')
      ])

      const analyticsData = analyticsResponse.ok ? await analyticsResponse.json() : null
      const statsData = statsResponse.ok ? await statsResponse.json() : null
      const accountsData = accountsResponse.ok ? await accountsResponse.json() : null
      const insightsData = insightsResponse.ok ? await insightsResponse.json() : null

      // Calculate finance metrics
      const totalRevenue = analyticsData?.summary?.totalIncome || 0
      const totalExpenses = analyticsData?.summary?.totalExpenses || 0
      const netIncome = totalRevenue - totalExpenses
      const cashBalance = accountsData?.accounts?.reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0) || 0
      
      setMetrics({
        totalRevenue,
        totalExpenses,
        netIncome,
        cashBalance,
        accountsReceivable: 0,
        accountsPayable: 0,
        revenueGrowth: analyticsData?.trends?.incomeGrowth || 0,
        expenseGrowth: analyticsData?.trends?.expenseGrowth || 0,
        profitMargin: totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0,
        quickRatio: cashBalance > 0 && totalExpenses > 0 ? cashBalance / (totalExpenses / 30) : 0,
        cashFlowTrend: netIncome >= 0 ? 'positive' : 'negative',
        upcomingPayments: insightsData?.recentActivity?.paymentsLastWeek || 0,
        overdueInvoices: insightsData?.unreconciled?.overSixtyDays || 0
      })

      setModuleStatus({
        bookkeeping: {
          unreconciledCount: accountsData?.totalUnreconciled || 0,
          lastSync: statsData?.recentTransactions?.[0]?.date || null,
          syncStatus: accountsData ? 'connected' : 'disconnected'
        },
        cashFlow: {
          forecast30Day: cashBalance + netIncome,
          criticalDate: null,
          healthScore: cashBalance > 0 ? Math.min(100, Math.round((cashBalance / Math.max(1, totalExpenses)) * 100)) : 0
        },
        reporting: {
          scheduledReports: 0,
          lastReportDate: null
        },
        budget: {
          utilizationRate: 0,
          varianceAlerts: 0
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
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
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
            <h1 className="text-4xl font-bold text-white mb-2">Finance Dashboard</h1>
            <p className="text-gray-400">Complete overview of your financial operations</p>
          </div>
          
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

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-emerald-500/20 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      ) : (
        <>
          {/* Key Financial Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Revenue */}
            <div className="group relative overflow-hidden bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-emerald-500/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
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
              </div>
            </div>

            {/* Total Expenses */}
            <div className="group relative overflow-hidden bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-red-500/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
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
              </div>
            </div>

            {/* Net Income */}
            <div className="group relative overflow-hidden bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-cyan-500/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-cyan-500/20 rounded-xl">
                    <Activity className="h-6 w-6 text-cyan-400" />
                  </div>
                  <span className="text-xs font-medium text-gray-400">
                    {metrics?.profitMargin.toFixed(1)}% margin
                  </span>
                </div>
                <div className={`text-3xl font-bold ${
                  (metrics?.netIncome ?? 0) >= 0 ? 'text-white' : 'text-red-400'
                }`}>
                  {formatCurrency(metrics?.netIncome || 0)}
                </div>
                <div className="text-sm text-gray-400 mt-1">Net Income</div>
              </div>
            </div>

            {/* Cash Balance */}
            <div className="group relative overflow-hidden bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-purple-500/50 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-500/20 rounded-xl">
                    <Wallet className="h-6 w-6 text-purple-400" />
                  </div>
                  <span className="text-xs font-medium text-gray-400">
                    All accounts
                  </span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {formatCurrency(metrics?.cashBalance || 0)}
                </div>
                <div className="text-sm text-gray-400 mt-1">Cash Balance</div>
              </div>
            </div>
          </div>

          {/* Finance Modules Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Bookkeeping Module */}
            <div 
              className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-emerald-500/50 transition-all cursor-pointer"
              onClick={() => router.push('/bookkeeping')}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-white flex items-center">
                    <div className="w-1 h-6 bg-emerald-500 rounded-full mr-3" />
                    Bookkeeping
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">Transaction management & reconciliation</p>
                </div>
                <ArrowUpRight className="h-5 w-5 text-gray-400" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Unreconciled</span>
                    {(moduleStatus?.bookkeeping.unreconciledCount ?? 0) > 0 && (
                      <AlertCircle className="h-4 w-4 text-amber-400" />
                    )}
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {moduleStatus?.bookkeeping.unreconciledCount || 0}
                  </div>
                  <div className="text-xs text-gray-500">transactions</div>
                </div>
                
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">Sync Status</span>
                    <div className={`w-2 h-2 rounded-full ${
                      moduleStatus?.bookkeeping.syncStatus === 'connected' 
                        ? 'bg-green-400' 
                        : 'bg-red-400'
                    }`} />
                  </div>
                  <div className="text-lg font-medium text-white capitalize">
                    {moduleStatus?.bookkeeping.syncStatus || 'Unknown'}
                  </div>
                  <div className="text-xs text-gray-500">Xero connection</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 bg-emerald-600/20 text-emerald-400 rounded-lg text-sm hover:bg-emerald-600/30 transition-colors">
                  SOP Generator
                </button>
                <button className="px-3 py-1.5 bg-purple-600/20 text-purple-400 rounded-lg text-sm hover:bg-purple-600/30 transition-colors">
                  View Transactions
                </button>
              </div>
            </div>

            {/* Cash Flow Management */}
            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-cyan-500/50 transition-all cursor-pointer opacity-75">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-white flex items-center">
                    <div className="w-1 h-6 bg-cyan-500 rounded-full mr-3" />
                    Cash Flow Management
                    <span className="ml-2 px-2 py-0.5 bg-slate-700 rounded text-xs text-gray-400">Coming Soon</span>
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">Liquidity tracking & forecasting</p>
                </div>
                <ArrowUpRight className="h-5 w-5 text-gray-400" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <span className="text-sm text-gray-400 block mb-2">Module Status</span>
                  <div className="text-lg font-medium text-gray-400">
                    Not Available
                  </div>
                  <div className="text-xs text-gray-500">coming soon</div>
                </div>
              </div>
            </div>

            {/* Financial Reporting */}
            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-purple-500/50 transition-all cursor-pointer opacity-75">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-white flex items-center">
                    <div className="w-1 h-6 bg-purple-500 rounded-full mr-3" />
                    Financial Reporting
                    <span className="ml-2 px-2 py-0.5 bg-slate-700 rounded text-xs text-gray-400">Coming Soon</span>
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">Statements & custom reports</p>
                </div>
                <ArrowUpRight className="h-5 w-5 text-gray-400" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <span className="text-sm text-gray-400 block mb-2">Module Status</span>
                  <div className="text-lg font-medium text-gray-400">
                    Not Available
                  </div>
                  <div className="text-xs text-gray-500">coming soon</div>
                </div>
              </div>
            </div>

            {/* Budget & Planning */}
            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 hover:border-amber-500/50 transition-all cursor-pointer opacity-75">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-white flex items-center">
                    <div className="w-1 h-6 bg-amber-500 rounded-full mr-3" />
                    Budget & Planning
                    <span className="ml-2 px-2 py-0.5 bg-slate-700 rounded text-xs text-gray-400">Coming Soon</span>
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">Budget control & forecasting</p>
                </div>
                <ArrowUpRight className="h-5 w-5 text-gray-400" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-900/50 rounded-lg p-4">
                  <span className="text-sm text-gray-400 block mb-2">Module Status</span>
                  <div className="text-lg font-medium text-gray-400">
                    Not Available
                  </div>
                  <div className="text-xs text-gray-500">coming soon</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Insights */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <PieChart className="h-5 w-5 mr-2 text-indigo-400" />
                Financial Health
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Quick Ratio</span>
                  <span className="text-sm font-medium text-white">{metrics?.quickRatio.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Cash Flow Trend</span>
                  <span className={`text-sm font-medium capitalize ${
                    metrics?.cashFlowTrend === 'positive' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {metrics?.cashFlowTrend}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Profit Margin</span>
                  <span className="text-sm font-medium text-white">
                    {metrics?.profitMargin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Clock className="h-5 w-5 mr-2 text-amber-400" />
                Pending Actions
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 bg-amber-500/10 rounded-lg">
                  <span className="text-sm text-amber-400">Unreconciled Transactions</span>
                  <span className="text-sm font-medium text-amber-400">
                    {moduleStatus?.bookkeeping.unreconciledCount || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-red-500/10 rounded-lg">
                  <span className="text-sm text-red-400">Old Unreconciled (60+ days)</span>
                  <span className="text-sm font-medium text-red-400">
                    {metrics?.overdueInvoices || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-blue-500/10 rounded-lg">
                  <span className="text-sm text-blue-400">Recent Payments (7 days)</span>
                  <span className="text-sm font-medium text-blue-400">
                    {metrics?.upcomingPayments || 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Target className="h-5 w-5 mr-2 text-green-400" />
                Period Summary
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Total Revenue</span>
                  <span className="text-sm font-medium text-white">
                    {formatCurrency(metrics?.totalRevenue || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Total Expenses</span>
                  <span className="text-sm font-medium text-white">
                    {formatCurrency(metrics?.totalExpenses || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Net Income</span>
                  <span className={`text-sm font-medium ${
                    (metrics?.netIncome ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatCurrency(metrics?.netIncome || 0)}
                  </span>
                </div>
                <div className="text-center mt-4">
                  <span className="text-xs text-gray-500">Based on {timeRange} data</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}