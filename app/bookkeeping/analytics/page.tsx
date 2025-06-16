'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, BarChart3, TrendingUp, TrendingDown, DollarSign, Calendar, PieChart, Activity, Download } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface AnalyticsData {
  summary: {
    totalTransactions: number
    totalIncome: number
    totalExpenses: number
    netAmount: number
    periodStart: string
    periodEnd: string
  }
  byAccount: Array<{
    account: string
    currency: string
    transactionCount: number
    totalAmount: number
  }>
  byMonth: Array<{
    month: string
    income: number
    expenses: number
    net: number
    transactionCount: number
  }>
  byCategory: Array<{
    category: string
    amount: number
    percentage: number
  }>
  trends: {
    incomeGrowth: number
    expenseGrowth: number
    topExpenseCategory: string
    topIncomeSource: string
  }
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month')
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)

  useEffect(() => {
    fetchAnalytics()
  }, [period])

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/v1/bookkeeping/analytics?period=${period}`)
      if (response.ok) {
        const data = await response.json()
        setAnalyticsData(data)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
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

  const formatPercentage = (value: number) => {
    const formatted = value.toFixed(1)
    return value >= 0 ? `+${formatted}%` : `${formatted}%`
  }

  if (loading || !analyticsData) {
    return (
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center">
              <BarChart3 className="h-8 w-8 mr-3 text-indigo-400" />
              Transaction Analytics
            </h1>
            <p className="text-gray-400">
              Comprehensive insights into your financial transactions
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Period Selector */}
            <div className="flex bg-slate-800/30 rounded-lg p-1">
              <button
                onClick={() => setPeriod('month')}
                className={`px-4 py-2 rounded-md text-sm transition-all ${
                  period === 'month'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setPeriod('quarter')}
                className={`px-4 py-2 rounded-md text-sm transition-all ${
                  period === 'quarter'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Quarter
              </button>
              <button
                onClick={() => setPeriod('year')}
                className={`px-4 py-2 rounded-md text-sm transition-all ${
                  period === 'year'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Year
              </button>
            </div>
            
            <button
              className="px-4 py-2 bg-slate-700/50 text-gray-300 rounded-lg hover:bg-slate-700/70 hover:text-white transition-all flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </button>
          </div>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 backdrop-blur-sm border border-emerald-500/30 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-500/20 rounded-xl">
              <TrendingUp className="h-6 w-6 text-emerald-400" />
            </div>
            <span className={`text-sm font-medium ${analyticsData.trends.incomeGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatPercentage(analyticsData.trends.incomeGrowth)}
            </span>
          </div>
          <div className="text-2xl font-bold text-white">
            {formatCurrency(analyticsData.summary.totalIncome)}
          </div>
          <div className="text-sm text-gray-400 mt-1">Total Income</div>
        </div>
        
        <div className="bg-gradient-to-br from-red-500/10 to-red-600/10 backdrop-blur-sm border border-red-500/30 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/20 rounded-xl">
              <TrendingDown className="h-6 w-6 text-red-400" />
            </div>
            <span className={`text-sm font-medium ${analyticsData.trends.expenseGrowth <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatPercentage(analyticsData.trends.expenseGrowth)}
            </span>
          </div>
          <div className="text-2xl font-bold text-white">
            {formatCurrency(analyticsData.summary.totalExpenses)}
          </div>
          <div className="text-sm text-gray-400 mt-1">Total Expenses</div>
        </div>
        
        <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 backdrop-blur-sm border border-indigo-500/30 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-500/20 rounded-xl">
              <DollarSign className="h-6 w-6 text-indigo-400" />
            </div>
            <Activity className="h-4 w-4 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {formatCurrency(analyticsData.summary.netAmount)}
          </div>
          <div className="text-sm text-gray-400 mt-1">Net Amount</div>
        </div>
        
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <Activity className="h-6 w-6 text-purple-400" />
            </div>
            <Calendar className="h-4 w-4 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {analyticsData.summary.totalTransactions}
          </div>
          <div className="text-sm text-gray-400 mt-1">Total Transactions</div>
        </div>
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Monthly Trend Chart */}
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
            <div className="w-1 h-6 bg-indigo-500 rounded-full mr-3" />
            Monthly Trend
          </h2>
          <div className="space-y-4">
            {analyticsData.byMonth.map((month, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-400">{month.month}</span>
                  <span className="text-sm text-gray-300">{month.transactionCount} transactions</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex h-8 bg-slate-700/30 rounded-lg overflow-hidden">
                      <div 
                        className="bg-emerald-500/50 flex items-center justify-end px-2"
                        style={{ width: `${(month.income / (month.income + Math.abs(month.expenses))) * 100}%` }}
                      >
                        <span className="text-xs text-white">{formatCurrency(month.income)}</span>
                      </div>
                      <div 
                        className="bg-red-500/50 flex items-center justify-start px-2"
                        style={{ width: `${(Math.abs(month.expenses) / (month.income + Math.abs(month.expenses))) * 100}%` }}
                      >
                        <span className="text-xs text-white">{formatCurrency(Math.abs(month.expenses))}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`text-sm font-medium ${month.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatCurrency(month.net)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Category Breakdown */}
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
            <div className="w-1 h-6 bg-purple-500 rounded-full mr-3" />
            Category Breakdown
          </h2>
          <div className="space-y-3">
            {analyticsData.byCategory.map((category, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center flex-1">
                  <div className="w-3 h-3 rounded-full mr-3" style={{ 
                    backgroundColor: [
                      '#10b981', '#8b5cf6', '#3b82f6', '#f59e0b', '#ef4444', '#06b6d4'
                    ][index % 6] 
                  }} />
                  <span className="text-gray-300">{category.category}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-24 bg-slate-700/30 rounded-full h-2">
                    <div 
                      className="h-full rounded-full"
                      style={{ 
                        width: `${category.percentage}%`,
                        backgroundColor: [
                          '#10b981', '#8b5cf6', '#3b82f6', '#f59e0b', '#ef4444', '#06b6d4'
                        ][index % 6]
                      }}
                    />
                  </div>
                  <span className="text-sm text-gray-400 w-12 text-right">{category.percentage}%</span>
                  <span className="text-sm font-medium text-white w-24 text-right">
                    {formatCurrency(category.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Account Breakdown Table */}
      <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
          <div className="w-1 h-6 bg-cyan-500 rounded-full mr-3" />
          Account Breakdown
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Account</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Currency</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Transactions</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {analyticsData.byAccount.map((account, index) => (
                <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4 text-gray-300">{account.account}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-slate-700/50 rounded text-xs text-gray-300">
                      {account.currency}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-300">{account.transactionCount}</td>
                  <td className="py-3 px-4 text-right font-medium text-white">
                    {formatCurrency(account.totalAmount, account.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Key Insights */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-emerald-500/10 to-transparent backdrop-blur-sm border border-emerald-500/30 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Top Income Source</h3>
          <p className="text-2xl font-bold text-emerald-400">{analyticsData.trends.topIncomeSource}</p>
        </div>
        
        <div className="bg-gradient-to-br from-red-500/10 to-transparent backdrop-blur-sm border border-red-500/30 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Top Expense Category</h3>
          <p className="text-2xl font-bold text-red-400">{analyticsData.trends.topExpenseCategory}</p>
        </div>
      </div>
    </div>
  )
}