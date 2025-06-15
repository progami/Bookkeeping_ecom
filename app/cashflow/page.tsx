'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown,
  Calendar, Download, Upload, RefreshCw, AlertTriangle, Info,
  DollarSign, Activity, FileDown, FileUp, Settings, ChevronRight
} from 'lucide-react'
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import toast, { Toaster } from 'react-hot-toast'
import { measurePageLoad } from '@/lib/performance-utils'
import { ModuleHeader } from '@/components/ui/module-header'
import { EmptyState } from '@/components/ui/empty-state'

// Import recharts components
import { 
  AreaChart, Area, BarChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, ReferenceLine
} from 'recharts'

interface ForecastData {
  date: string
  openingBalance: number
  closingBalance: number
  inflows: {
    fromInvoices: number
    fromRepeating: number
    total: number
  }
  outflows: {
    toBills: number
    toRepeating: number
    toTaxes: number
    toPatterns: number
    toBudgets: number
    total: number
  }
  confidenceLevel: number
  alerts: Array<{
    type: string
    severity: 'info' | 'warning' | 'critical'
    message: string
    amount?: number
  }>
  scenarios?: {
    bestCase: number
    worstCase: number
  }
}

interface ForecastSummary {
  days: number
  lowestBalance: number
  lowestBalanceDate: string
  totalInflows: number
  totalOutflows: number
  averageConfidence: number
  criticalAlerts: number
}

export default function CashFlowPage() {
  // Measure page performance
  if (typeof window !== 'undefined') {
    measurePageLoad('Cash Flow Forecast');
  }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [forecastDays, setForecastDays] = useState(90)
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [showScenarios, setShowScenarios] = useState(false)
  const [forecast, setForecast] = useState<ForecastData[]>([])
  const [summary, setSummary] = useState<ForecastSummary | null>(null)
  const [selectedDate, setSelectedDate] = useState<ForecastData | null>(null)

  useEffect(() => {
    fetchForecast()
  }, [forecastDays])

  const fetchForecast = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/v1/cashflow/forecast?days=${forecastDays}&scenarios=${showScenarios}`,
        {
          headers: { 'Cache-Control': 'max-age=300' } // 5 min cache for forecast
        }
      )
      
      if (!response.ok) throw new Error('Failed to fetch forecast')
      
      const data = await response.json()
      setForecast(data.forecast)
      setSummary(data.summary)
    } catch (error) {
      console.error('Error fetching forecast:', error)
      toast.error('Failed to load cash flow forecast')
    } finally {
      setLoading(false)
    }
  }


  const regenerateForecast = async () => {
    try {
      const response = await fetch('/api/v1/cashflow/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: forecastDays, regenerate: true }),
      })
      
      if (!response.ok) throw new Error('Regeneration failed')
      
      await fetchForecast()
    } catch (error) {
      console.error('Regeneration error:', error)
      toast.error('Failed to regenerate forecast')
    }
  }

  const handleBudgetImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', file.name.toLowerCase().includes('xero') ? 'xero' : 'manual')

    try {
      toast.loading('Importing budget...', { id: 'import' })
      
      const response = await fetch('/api/v1/cashflow/budget/import', {
        method: 'POST',
        body: formData,
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast.success(`Imported ${result.imported} budget entries`, { id: 'import' })
        await regenerateForecast()
      } else {
        toast.error(`Import completed with errors: ${result.errors.join(', ')}`, { id: 'import' })
      }
    } catch (error) {
      console.error('Import error:', error)
      toast.error('Import failed', { id: 'import' })
    }
  }

  const downloadBudgetTemplate = async () => {
    try {
      const response = await fetch('/api/v1/cashflow/budget/template')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'budget-template.xlsx'
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success('Template downloaded')
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Failed to download template')
    }
  }

  const exportBudget = async () => {
    try {
      const response = await fetch('/api/v1/cashflow/budget/export')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `budget-export-${format(new Date(), 'yyyy-MM')}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success('Budget exported')
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export budget')
    }
  }

  // Process forecast data for charts
  const chartData = forecast.map(f => ({
    date: format(new Date(f.date), 'MMM dd'),
    balance: f.closingBalance,
    inflows: f.inflows.total,
    outflows: -f.outflows.total,
    bestCase: f.scenarios?.bestCase,
    worstCase: f.scenarios?.worstCase,
  }))

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Toaster position="top-right" />
      
      {/* Header */}
      <ModuleHeader 
        title="Cash Flow Forecast"
        subtitle={`${forecastDays}-day projection with ${Math.round((summary?.averageConfidence || 0) * 100)}% average confidence`}
        backTo="/finance"
        backLabel="Back to Finance"
        actions={
          <select
            value={forecastDays}
            onChange={(e) => setForecastDays(parseInt(e.target.value))}
            className="px-4 py-2 bg-slate-800/50 text-white rounded-lg border border-slate-700 focus:border-cyan-500 focus:outline-none"
          >
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
            <option value="180">180 days</option>
            <option value="365">1 year</option>
          </select>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-cyan-500/20 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      ) : !forecast || forecast.length === 0 ? (
        <EmptyState 
          title="Cash Flow Forecasting"
          description="Connect your Xero account to generate accurate cash flow forecasts based on your real financial data."
          icon={
            <div className="w-20 h-20 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto">
              <Activity className="h-10 w-10 text-cyan-400" />
            </div>
          }
        />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-cyan-500/20 rounded-xl">
                  <DollarSign className="h-6 w-6 text-cyan-400" />
                </div>
                <span className="text-xs text-gray-400">Current</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(forecast[0]?.openingBalance || 0)}
              </div>
              <div className="text-sm text-gray-400 mt-1">Cash Balance</div>
            </div>

            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-red-500/20 rounded-xl">
                  <TrendingDown className="h-6 w-6 text-red-400" />
                </div>
                <span className="text-xs text-gray-400">
                  {summary?.lowestBalanceDate ? format(new Date(summary.lowestBalanceDate), 'MMM dd') : '-'}
                </span>
              </div>
              <div className={`text-2xl font-bold ${
                (summary?.lowestBalance || 0) < 0 ? 'text-red-400' : 'text-white'
              }`}>
                {formatCurrency(summary?.lowestBalance || 0)}
              </div>
              <div className="text-sm text-gray-400 mt-1">Lowest Balance</div>
            </div>

            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-500/20 rounded-xl">
                  <ArrowUpRight className="h-6 w-6 text-green-400" />
                </div>
                <span className="text-xs text-gray-400">{forecastDays} days</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(summary?.totalInflows || 0)}
              </div>
              <div className="text-sm text-gray-400 mt-1">Total Inflows</div>
            </div>

            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-amber-500/20 rounded-xl">
                  <AlertTriangle className="h-6 w-6 text-amber-400" />
                </div>
                <span className="text-xs text-gray-400">Alerts</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {summary?.criticalAlerts || 0}
              </div>
              <div className="text-sm text-gray-400 mt-1">Critical Alerts</div>
            </div>
          </div>

          {/* Main Chart */}
          <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Cash Flow Projection</h2>
              <div className="flex items-center gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={showScenarios}
                    onChange={(e) => {
                      setShowScenarios(e.target.checked)
                      fetchForecast()
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-400">Show Scenarios</span>
                </label>
                <div className="flex gap-2">
                  {['daily', 'weekly', 'monthly'].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode as any)}
                      className={`px-3 py-1 rounded-lg text-sm ${
                        viewMode === mode
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                      }`}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={(value) => `£${value / 1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="5 5" />
                
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#06b6d4"
                  fillOpacity={1}
                  fill="url(#colorBalance)"
                  name="Cash Balance"
                />
                
                {showScenarios && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="bestCase"
                      stroke="#10b981"
                      strokeDasharray="5 5"
                      dot={false}
                      name="Best Case"
                    />
                    <Line
                      type="monotone"
                      dataKey="worstCase"
                      stroke="#ef4444"
                      strokeDasharray="5 5"
                      dot={false}
                      name="Worst Case"
                    />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Cash Flow Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Inflows/Outflows Chart */}
            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Daily Cash Movements</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.slice(0, 30)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(value) => `£${Math.abs(value) / 1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                    labelStyle={{ color: '#94a3b8' }}
                    formatter={(value: number) => formatCurrency(Math.abs(value))}
                  />
                  <Legend />
                  <Bar dataKey="inflows" fill="#10b981" name="Inflows" />
                  <Bar dataKey="outflows" fill="#ef4444" name="Outflows" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Alerts & Actions */}
            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Alerts & Actions</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {forecast
                  .flatMap(f => f.alerts.map(a => ({ ...a, date: f.date })))
                  .filter(a => a.severity !== 'info')
                  .slice(0, 10)
                  .map((alert, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${
                        alert.severity === 'critical'
                          ? 'bg-red-500/10 border-red-500/50'
                          : 'bg-amber-500/10 border-amber-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <AlertTriangle className={`h-4 w-4 mr-2 ${
                            alert.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
                          }`} />
                          <span className="text-sm text-white">{alert.message}</span>
                        </div>
                        <span className="text-xs text-gray-400">
                          {format(new Date(alert.date), 'MMM dd')}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Budget Management */}
          <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Budget Management</h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={downloadBudgetTemplate}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors flex items-center"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Download Template
                </button>
                <label className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center cursor-pointer">
                  <FileUp className="h-4 w-4 mr-2" />
                  Import Budget
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleBudgetImport}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={exportBudget}
                  className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors flex items-center"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Budget
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-900/50 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">Budget Status</div>
                <div className="text-lg font-medium text-white">Active</div>
                <div className="text-xs text-gray-500">12 months loaded</div>
              </div>
              <div className="p-4 bg-slate-900/50 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">Import Options</div>
                <div className="text-xs text-gray-300">
                  • Manual budget entry (Excel/CSV)<br />
                  • Xero Budget Manager export
                </div>
              </div>
              <div className="p-4 bg-slate-900/50 rounded-lg">
                <div className="text-sm text-gray-400 mb-1">Last Import</div>
                <div className="text-lg font-medium text-white">
                  {format(new Date(), 'MMM dd, yyyy')}
                </div>
                <div className="text-xs text-gray-500">Manual import</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}