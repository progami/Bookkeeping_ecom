'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, TrendingUp, Building2, DollarSign, Calendar, BarChart3,
  Download, PieChart, TrendingDown, Activity
} from 'lucide-react'
import { measurePageLoad } from '@/lib/performance-utils'
import { UnifiedPageHeader } from '@/components/ui/unified-page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/contexts/AuthContext'
import { formatNumber } from '@/lib/design-tokens'
import { SkeletonCard, SkeletonChart, SkeletonTable } from '@/components/ui/skeleton'
import {
  LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

interface VendorData {
  name: string
  totalSpend: number
  transactionCount: number
  lastTransaction: string
  growth?: number
}

interface SpendTrendData {
  date: string
  amount: number
}

interface CategoryData {
  category: string
  amount: number
  percentage: number
}

export default function BusinessAnalytics() {
  // Measure page performance
  if (typeof window !== 'undefined') {
    measurePageLoad('Business Analytics');
  }
  const router = useRouter()
  const { hasActiveToken, checkAuthStatus, isLoading: authLoading } = useAuth()
  const [vendors, setVendors] = useState<VendorData[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('30d')
  const [totalSpend, setTotalSpend] = useState(0)
  const [vendorCount, setVendorCount] = useState(0)
  const [topConcentration, setTopConcentration] = useState(0)
  const [spendTrend, setSpendTrend] = useState<SpendTrendData[]>([])
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryData[]>([])
  const [growthRate, setGrowthRate] = useState(0)

  // Re-check auth status on mount
  useEffect(() => {
    console.log('[Analytics] Component mounted, checking auth status...')
    checkAuthStatus()
  }, [])

  useEffect(() => {
    console.log('[Analytics] Auth state changed:', { authLoading, hasActiveToken })
    if (!authLoading && hasActiveToken) {
      fetchVendorData()
      fetchSpendTrend()
      fetchCategoryBreakdown()
    } else if (!authLoading && !hasActiveToken) {
      // Clear data when not connected
      setVendors([])
      setSpendTrend([])
      setCategoryBreakdown([])
      setLoading(false)
    }
  }, [timeRange, hasActiveToken, authLoading])

  const fetchVendorData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/v1/analytics/top-vendors?period=${timeRange}`, {
        headers: { 'Cache-Control': 'max-age=600' }
      })
      
      if (response.ok) {
        const data = await response.json()
        
        // Enhanced vendor data with growth metrics
        const enhancedVendors = data.topVendors?.map((vendor: any) => ({
          name: vendor.name,
          totalSpend: vendor.totalAmount,
          transactionCount: vendor.transactionCount,
          lastTransaction: vendor.lastTransaction,
          growth: vendor.growth || 0
        })) || []
        
        setVendors(enhancedVendors)
        
        // Calculate metrics
        const total = data.totalSpend || 0
        setTotalSpend(total)
        setVendorCount(data.vendorCount || 0)
        
        // Calculate top 5 concentration
        if (data.summary?.topVendorPercentage) {
          setTopConcentration(data.summary.topVendorPercentage)
        }
        
        // Calculate overall growth rate
        if (data.topVendors?.length > 0) {
          const avgGrowth = data.topVendors.reduce((sum: number, v: any) => sum + (v.growth || 0), 0) / data.topVendors.length
          setGrowthRate(avgGrowth)
        }
      }
    } catch (error) {
      console.error('Failed to fetch vendor data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSpendTrend = async () => {
    try {
      const response = await fetch(`/api/v1/analytics/spend-trend?period=${timeRange}`, {
        headers: { 'Cache-Control': 'max-age=600' }
      })
      
      if (response.ok) {
        const data = await response.json()
        setSpendTrend(data.trend || [])
      }
    } catch (error) {
      console.error('Failed to fetch spend trend:', error)
      // Generate mock data for now
      generateMockSpendTrend()
    }
  }

  const fetchCategoryBreakdown = async () => {
    try {
      const response = await fetch(`/api/v1/analytics/category-breakdown?period=${timeRange}`, {
        headers: { 'Cache-Control': 'max-age=600' }
      })
      
      if (response.ok) {
        const data = await response.json()
        setCategoryBreakdown(data.categories || [])
      }
    } catch (error) {
      console.error('Failed to fetch category breakdown:', error)
      // Generate mock data for now
      generateMockCategoryData()
    }
  }

  const generateMockSpendTrend = () => {
    // Generate trend data based on time range
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365
    const trend: SpendTrendData[] = []
    const today = new Date()
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      trend.push({
        date: date.toISOString().split('T')[0],
        amount: Math.floor(Math.random() * 1000) + 200
      })
    }
    
    setSpendTrend(trend)
  }

  const generateMockCategoryData = () => {
    // Mock category data based on common expense categories
    const categories = [
      { category: 'Software & Tools', amount: totalSpend * 0.35, percentage: 35 },
      { category: 'Marketing', amount: totalSpend * 0.25, percentage: 25 },
      { category: 'Operations', amount: totalSpend * 0.20, percentage: 20 },
      { category: 'Professional Services', amount: totalSpend * 0.15, percentage: 15 },
      { category: 'Other', amount: totalSpend * 0.05, percentage: 5 }
    ]
    setCategoryBreakdown(categories)
  }

  const formatCurrency = (amount: number) => {
    return formatNumber(amount, { currency: true, decimals: 0, abbreviate: true })
  }

  const exportData = () => {
    // Prepare CSV data
    const csvData = [
      ['Vendor Analytics Report', `Period: ${timeRange}`],
      [''],
      ['Summary'],
      ['Total Spend', formatCurrency(totalSpend)],
      ['Active Vendors', vendorCount],
      ['Average Growth Rate', `${growthRate.toFixed(1)}%`],
      [''],
      ['Top Vendors'],
      ['Rank', 'Vendor', 'Total Spend', 'Transactions', '% of Total', 'Growth']
    ]
    
    vendors.forEach((vendor, index) => {
      csvData.push([
        (index + 1).toString(),
        vendor.name,
        formatCurrency(vendor.totalSpend),
        vendor.transactionCount.toString(),
        `${((vendor.totalSpend / totalSpend) * 100).toFixed(1)}%`,
        `${vendor.growth?.toFixed(1) || 0}%`
      ])
    })
    
    // Convert to CSV string
    const csv = csvData.map(row => row.join(',')).join('\n')
    
    // Download file
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-report-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444']

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <UnifiedPageHeader 
        title="Business Analytics"
        description="Comprehensive insights into your business performance"
        showAuthStatus={true}
        showTimeRangeSelector={true}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        actions={
          vendors.length > 0 && (
            <button
              onClick={exportData}
              className="px-4 py-2 bg-indigo-600/20 text-indigo-400 rounded-lg hover:bg-indigo-600/30 transition-colors flex items-center gap-2 border border-indigo-500/30"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          )
        }
      />

        {loading || authLoading ? (
          <>
            {/* Loading Skeletons */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              {[...Array(5)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <SkeletonChart />
              <SkeletonChart />
            </div>
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
              <SkeletonTable />
            </div>
          </>
        ) : !hasActiveToken ? (
          <EmptyState 
            title="Unlock Business Intelligence"
            description="Connect your Xero account to analyze vendor spending patterns, identify cost-saving opportunities, and make data-driven decisions."
            actionLabel="Connect to Xero"
            illustration="analytics"
            steps={[
              {
                icon: <Building2 className="h-5 w-5 text-indigo-400" />,
                title: "Vendor Analysis",
                description: "Track spending patterns across all suppliers"
              },
              {
                icon: <TrendingUp className="h-5 w-5 text-emerald-400" />,
                title: "Growth Metrics",
                description: "Monitor expense trends and growth rates"
              },
              {
                icon: <PieChart className="h-5 w-5 text-purple-400" />,
                title: "Category Insights",
                description: "Understand spending distribution by category"
              }
            ]}
          />
        ) : (
          <>
            {/* Enhanced Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-indigo-500/20 rounded-xl">
                    <DollarSign className="h-6 w-6 text-indigo-400" />
                  </div>
                  <span className={`text-xs font-medium ${growthRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(1)}%
                  </span>
                </div>
                <div className="text-3xl font-bold text-white">
                  {formatCurrency(totalSpend)}
                </div>
                <div className="text-sm text-gray-400 mt-1">Total Spend</div>
              </div>

              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-emerald-500/20 rounded-xl">
                    <Building2 className="h-6 w-6 text-emerald-400" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-white">
                  {vendorCount}
                </div>
                <div className="text-sm text-gray-400 mt-1">Active Vendors</div>
              </div>

              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-500/20 rounded-xl">
                    <BarChart3 className="h-6 w-6 text-purple-400" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-white">
                  {topConcentration.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-400 mt-1">Top 5 Concentration</div>
              </div>

              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-cyan-500/20 rounded-xl">
                    <TrendingUp className="h-6 w-6 text-cyan-400" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white truncate">
                  {vendors[0]?.name || 'N/A'}
                </div>
                <div className="text-sm text-gray-400 mt-1">Top Vendor</div>
              </div>

              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-amber-500/20 rounded-xl">
                    <Activity className="h-6 w-6 text-amber-400" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white">
                  {formatCurrency(totalSpend / (vendorCount || 1))}
                </div>
                <div className="text-sm text-gray-400 mt-1">Avg per Vendor</div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Spend Trend Chart */}
              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <h2 className="text-xl font-semibold text-white mb-6">Spend Trend</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={spendTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#9CA3AF"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => {
                        const date = new Date(value)
                        return timeRange === 'year' 
                          ? date.toLocaleDateString('en-GB', { month: 'short' })
                          : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                      }}
                    />
                    <YAxis 
                      stroke="#9CA3AF"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: '1px solid #475569',
                        borderRadius: '8px'
                      }}
                      formatter={(value: any) => formatCurrency(value)}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="#6366f1" 
                      strokeWidth={2}
                      dot={{ fill: '#6366f1', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Category Breakdown */}
              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <h2 className="text-xl font-semibold text-white mb-6">Expense Breakdown</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <RePieChart>
                    <Pie
                      data={categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ percentage }) => `${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="amount"
                    >
                      {categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: '1px solid #475569',
                        borderRadius: '8px'
                      }}
                      formatter={(value: any) => formatCurrency(value)}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value) => value}
                    />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Enhanced Top Vendors Table */}
            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-6">Top Vendors Analysis</h2>
              
              {vendors.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Rank</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Vendor</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Total Spend</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Transactions</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">% of Total</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Growth</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendors.map((vendor, index) => (
                        <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-800/50">
                          <td className="py-4 px-4">
                            <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center">
                              <span className="text-indigo-400 font-semibold">{index + 1}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-white font-medium">{vendor.name}</span>
                          </td>
                          <td className="py-4 px-4 text-right text-white font-medium">
                            {formatCurrency(vendor.totalSpend)}
                          </td>
                          <td className="py-4 px-4 text-right text-gray-400">
                            {vendor.transactionCount}
                          </td>
                          <td className="py-4 px-4 text-right text-gray-400">
                            {totalSpend > 0 ? ((vendor.totalSpend / totalSpend) * 100).toFixed(1) : '0.0'}%
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className={`font-medium ${
                              (vendor.growth || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {(vendor.growth || 0) >= 0 ? '+' : ''}{vendor.growth?.toFixed(1) || 0}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-400">No vendor data available for this period</p>
                </div>
              )}
            </div>

            {/* Additional Analytics Sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <PieChart className="h-5 w-5 mr-2 text-indigo-400" />
                  Vendor Insights
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Average Transaction Size</span>
                    <span className="text-white font-medium">
                      {formatCurrency(vendors.reduce((sum, v) => sum + (v.totalSpend / v.transactionCount), 0) / (vendors.length || 1))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Most Active Vendor</span>
                    <span className="text-white font-medium">
                      {vendors.reduce((max, v) => v.transactionCount > (max?.transactionCount || 0) ? v : max, vendors[0])?.name || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Fastest Growing</span>
                    <span className="text-white font-medium">
                      {vendors.reduce((max, v) => (v.growth || 0) > (max?.growth || 0) ? v : max, vendors[0])?.name || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <Activity className="h-5 w-5 mr-2 text-emerald-400" />
                  Performance Metrics
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Daily Average Spend</span>
                    <span className="text-white font-medium">
                      {formatCurrency(totalSpend / (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Vendor Efficiency</span>
                    <span className="text-white font-medium">
                      {((vendors.filter(v => (v.growth || 0) < 0).length / (vendors.length || 1)) * 100).toFixed(0)}% reducing
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Concentration Risk</span>
                    <span className={`font-medium ${topConcentration > 70 ? 'text-amber-400' : 'text-green-400'}`}>
                      {topConcentration > 70 ? 'High' : topConcentration > 50 ? 'Medium' : 'Low'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
    </div>
  )
}