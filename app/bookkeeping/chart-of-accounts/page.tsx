'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw, Search, Filter, BookOpen, Download } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

interface GLAccount {
  id: string
  code: string
  name: string
  type: string
  status: string
  class: string | null
  description: string | null
  systemAccount: boolean
  showInExpenseClaims: boolean
  enablePaymentsToAccount: boolean
  reportingCode: string | null
  reportingCodeName: string | null
}

export default function ChartOfAccountsPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<GLAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('ALL')
  const [totalFromXero, setTotalFromXero] = useState<number | null>(null)
  const [hideArchived, setHideArchived] = useState(true)
  
  // User-friendly type names
  const typeLabels: Record<string, string> = {
    'REVENUE': 'Income',
    'DIRECTCOSTS': 'Cost of Goods Sold',
    'EXPENSE': 'Operating Expenses',
    'OVERHEADS': 'Overhead Expenses',
    'OTHERINCOME': 'Other Income',
    'CURRENT': 'Current Assets',
    'FIXED': 'Fixed Assets',
    'INVENTORY': 'Inventory',
    'CURRLIAB': 'Current Liabilities',
    'TERMLIAB': 'Long-term Liabilities',
    'EQUITY': 'Owner\'s Equity'
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/v1/xero/sync-gl-accounts')
      if (response.ok) {
        const data = await response.json()
        setAccounts(data.allAccounts || [])
      } else {
        toast.error('Failed to fetch accounts')
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
      toast.error('Failed to fetch accounts')
    } finally {
      setLoading(false)
    }
  }

  const syncAccounts = async () => {
    try {
      setSyncing(true)
      const response = await fetch('/api/v1/xero/sync-gl-accounts', {
        method: 'POST'
      })
      const data = await response.json()
      
      if (data.success) {
        setTotalFromXero(data.stats.total)
        toast.success(`Synced ${data.stats.total} accounts from Xero (${data.stats.created} new, ${data.stats.updated} updated)`)
        fetchAccounts()
      } else {
        toast.error(`Failed to sync: ${data.error}`)
      }
    } catch (error) {
      toast.error('Error syncing accounts')
    } finally {
      setSyncing(false)
    }
  }

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = 
      account.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (account.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = filterType === 'ALL' || account.type === filterType
    const matchesArchived = !hideArchived || account.status === 'ACTIVE'
    
    return matchesSearch && matchesType && matchesArchived
  })

  const accountTypes = [...new Set(accounts.map(acc => acc.type))].sort()

  const exportToCSV = () => {
    const headers = ['Code', 'Name', 'Type', 'Description', 'Status']
    const rows = filteredAccounts.map(acc => [
      acc.code,
      acc.name,
      acc.type,
      acc.description || '',
      acc.status
    ])
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chart-of-accounts-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/bookkeeping')}
          className="text-gray-400 hover:text-white transition-colors mb-4 inline-flex items-center"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Chart of Accounts</h1>
            <p className="text-gray-400">
              Showing {filteredAccounts.length} of {accounts.length} accounts
              {totalFromXero && ` (${totalFromXero} available in Xero)`}
            </p>
          </div>
          
          <div className="flex gap-3 items-center">
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input
                type="checkbox"
                checked={hideArchived}
                onChange={(e) => setHideArchived(e.target.checked)}
                className="rounded border-gray-600 bg-slate-800/50 text-amber-500 focus:ring-amber-500"
              />
              Hide Archived
            </label>
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-slate-800/50 text-gray-300 rounded-lg hover:bg-slate-800/70 transition-colors flex items-center gap-2 border border-slate-700"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              onClick={syncAccounts}
              disabled={syncing}
              className="px-4 py-2 bg-amber-600/20 text-amber-400 rounded-lg hover:bg-amber-600/30 transition-colors flex items-center gap-2 border border-amber-500/30"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync from Xero'}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by code, name, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder-gray-500"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 bg-slate-800/50 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          >
            <option value="ALL">All Types</option>
            {accountTypes.map(type => (
              <option key={type} value={type}>{typeLabels[type] || type}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Accounts Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-amber-500/20 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-12 text-center">
          <BookOpen className="h-16 w-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No accounts found</h3>
          <p className="text-gray-400 mb-6">
            Click "Sync from Xero" to import your Chart of Accounts
          </p>
          <button
            onClick={syncAccounts}
            className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
          >
            Sync from Xero
          </button>
        </div>
      ) : (
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                      {account.code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {account.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        account.type === 'REVENUE' ? 'bg-green-500/20 text-green-400' :
                        account.type === 'EXPENSE' ? 'bg-red-500/20 text-red-400' :
                        account.type === 'ASSET' ? 'bg-blue-500/20 text-blue-400' :
                        account.type === 'LIABILITY' ? 'bg-yellow-500/20 text-yellow-400' :
                        account.type === 'EQUITY' ? 'bg-purple-500/20 text-purple-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {typeLabels[account.type] || account.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {account.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        account.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {account.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredAccounts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400">No accounts match your search criteria</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}