'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, TrendingUp, Building2, DollarSign, Calendar, BarChart3 } from 'lucide-react'

interface VendorData {
  name: string
  totalSpend: number
  transactionCount: number
  lastTransaction: string
}

export default function BusinessAnalytics() {
  const router = useRouter()
  const [vendors, setVendors] = useState<VendorData[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('30d')
  const [totalSpend, setTotalSpend] = useState(0)
  const [vendorCount, setVendorCount] = useState(0)
  const [topConcentration, setTopConcentration] = useState(0)

  useEffect(() => {
    fetchVendorData()
  }, [timeRange])

  const fetchVendorData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/v1/analytics/top-vendors')
      
      if (response.ok) {
        const data = await response.json()
        setVendors(data.vendors || [])
        
        // Calculate metrics
        const total = data.vendors?.reduce((sum: number, v: VendorData) => sum + v.totalSpend, 0) || 0
        setTotalSpend(total)
        setVendorCount(data.vendors?.length || 0)
        
        // Calculate top 5 concentration
        if (data.vendors?.length > 0 && total > 0) {
          const top5Total = data.vendors.slice(0, 5).reduce((sum: number, v: VendorData) => sum + v.totalSpend, 0)
          setTopConcentration((top5Total / total) * 100)
        }
      }
    } catch (error) {
      console.error('Failed to fetch vendor data:', error)
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

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/finance')}
            className="text-gray-400 hover:text-white transition-colors mb-4 inline-flex items-center"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Finance
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Business Analytics</h1>
              <p className="text-gray-400">Comprehensive insights into your business performance</p>
            </div>
            
            <select 
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 bg-slate-800/50 text-white rounded-lg border border-slate-700 focus:border-indigo-500 focus:outline-none"
            >
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="90d">90 days</option>
              <option value="year">year</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-500/20 rounded-full animate-pulse" />
              <div className="absolute inset-0 w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-indigo-500/20 rounded-xl">
                    <DollarSign className="h-6 w-6 text-indigo-400" />
                  </div>
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
                <div className="text-2xl font-bold text-white">
                  {vendors[0]?.name || 'N/A'}
                </div>
                <div className="text-sm text-gray-400 mt-1">Top Vendor</div>
              </div>
            </div>

            {/* Top Vendors Table */}
            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-6">Top 5 Vendors by Spend</h2>
              
              {vendors.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Vendor</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Total Spend</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Transactions</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendors.slice(0, 5).map((vendor, index) => (
                        <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-800/50">
                          <td className="py-4 px-4">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center mr-3">
                                <span className="text-indigo-400 font-semibold">{index + 1}</span>
                              </div>
                              <span className="text-white font-medium">{vendor.name}</span>
                            </div>
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
                <h3 className="text-lg font-semibold text-white mb-4">Vendor Analytics</h3>
                <p className="text-gray-400">Deep dive into vendor relationships and spending patterns</p>
              </div>

              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Revenue Analytics</h3>
                <p className="text-gray-400">Coming soon: Customer and revenue insights</p>
              </div>

              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Expense Breakdown</h3>
                <p className="text-gray-400">Coming soon: Category-wise expense analysis</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}