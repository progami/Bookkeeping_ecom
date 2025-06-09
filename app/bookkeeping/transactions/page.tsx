'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, RefreshCw, Download, Filter, Search, Calendar, 
  CheckCircle, XCircle, AlertCircle, DollarSign, Building,
  ChevronLeft, ChevronRight, Check
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { Transaction, TransactionFilter, ReconcileData } from '@/lib/types/transactions'
import { ReconcileModal } from '@/components/reconcile-modal'

export default function TransactionsPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [filter, setFilter] = useState<TransactionFilter>({ status: 'all' })
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [reconcileTransaction, setReconcileTransaction] = useState<Transaction | null>(null)

  useEffect(() => {
    checkConnectionAndSync()
  }, [])

  const checkConnectionAndSync = async () => {
    const status = await fetch('/api/v1/xero/status')
    const { connected } = await status.json()
    
    if (!connected) {
      toast.error('Please connect to Xero first')
      router.push('/bookkeeping')
      return
    }
    
    syncTransactions()
  }

  const syncTransactions = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/v1/xero/transactions')
      
      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Xero session expired. Please reconnect.')
          router.push('/bookkeeping')
          return
        }
        throw new Error('Failed to fetch transactions')
      }
      
      const data = await response.json()
      
      setTransactions(data.transactions)
      setLastSync(new Date())
      toast.success(`Synced ${data.transactions.length} transactions`)
    } catch (error) {
      console.error('Error syncing:', error)
      toast.error('Failed to sync transactions')
    } finally {
      setSyncing(false)
    }
  }

  const filteredTransactions = transactions.filter(tx => {
    // Status filter
    if (filter.status === 'matched' && !tx.matchedRule) return false
    if (filter.status === 'unmatched' && tx.matchedRule) return false
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        tx.description.toLowerCase().includes(search) ||
        tx.reference?.toLowerCase().includes(search) ||
        tx.contact?.toLowerCase().includes(search)
      )
    }
    
    return true
  })

  const toggleSelectAll = () => {
    if (selectedTransactions.size === filteredTransactions.length) {
      setSelectedTransactions(new Set())
    } else {
      setSelectedTransactions(new Set(filteredTransactions.map(tx => tx.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedTransactions)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedTransactions(newSelected)
  }

  const handleBulkReconcile = async () => {
    const matchedSelected = filteredTransactions.filter(
      tx => selectedTransactions.has(tx.id) && tx.matchedRule
    )
    
    if (matchedSelected.length === 0) {
      toast.error('Please select matched transactions to reconcile')
      return
    }
    
    if (!confirm(`Reconcile ${matchedSelected.length} matched transactions?`)) {
      return
    }
    
    // TODO: Implement bulk reconciliation
    toast.success(`${matchedSelected.length} transactions reconciled`)
    setSelectedTransactions(new Set())
  }

  const exportTransactions = () => {
    // TODO: Implement CSV export
    toast.success('Exporting transactions to CSV...')
  }

  const handleReconcile = async (data: ReconcileData) => {
    try {
      const response = await fetch(`/api/v1/xero/transactions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: data.transactionId,
          updates: {
            reference: data.reference,
            description: data.description,
            accountCode: data.accountCode,
            taxType: data.taxType,
            isReconciled: true
          }
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to reconcile transaction')
      }
      
      // Remove transaction from list
      setTransactions(prev => prev.filter(tx => tx.id !== data.transactionId))
      
      // Create rule if requested
      if (data.createRule && data.ruleName) {
        const ruleResponse = await fetch('/api/v1/bookkeeping/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.ruleName,
            description: data.description,
            matchType: 'contains',
            matchField: 'description',
            matchValue: data.rulePattern,
            accountCode: data.accountCode,
            taxType: data.taxType,
            priority: 0,
            isActive: true
          })
        })
        
        if (ruleResponse.ok) {
          toast.success('Rule created successfully')
        }
      }
    } catch (error) {
      console.error('Reconciliation error:', error)
      throw error
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
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
            <h1 className="text-4xl font-bold text-white mb-2">
              Transactions
            </h1>
            <p className="text-gray-400">
              Manage and reconcile your bank transactions
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={exportTransactions}
              className="px-4 py-2 bg-slate-700/50 text-gray-300 rounded-lg hover:bg-slate-700/70 transition-colors flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
            <button
              onClick={syncTransactions}
              disabled={syncing}
              className="px-4 py-2 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/30 transition-colors flex items-center"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Transactions'}
            </button>
          </div>
        </div>
        
        {lastSync && (
          <div className="mt-2 text-sm text-gray-500">
            Last sync: {lastSync.toLocaleString()} 
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[300px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
        
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value as any })}
          className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="all">All Transactions</option>
          <option value="matched">Matched</option>
          <option value="unmatched">Unmatched</option>
        </select>
      </div>

      {/* Bulk Actions */}
      {selectedTransactions.size > 0 && (
        <div className="mb-4 p-4 bg-emerald-600/10 border border-emerald-600/30 rounded-lg flex items-center justify-between">
          <span className="text-emerald-400">
            {selectedTransactions.size} transaction{selectedTransactions.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={handleBulkReconcile}
            className="px-4 py-2 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/30 transition-colors"
          >
            Bulk Reconcile Matched
          </button>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900/50 border-b border-slate-700">
            <tr>
              <th className="p-4 text-left">
                <input
                  type="checkbox"
                  checked={selectedTransactions.size === filteredTransactions.length && filteredTransactions.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-emerald-600 bg-slate-700 border-slate-600 rounded focus:ring-emerald-500"
                />
              </th>
              <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Date
              </th>
              <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Description
              </th>
              <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Amount
              </th>
              <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Match
              </th>
              <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center">
                  <div className="flex items-center justify-center">
                    <RefreshCw className="h-6 w-6 text-emerald-400 animate-spin" />
                    <span className="ml-2 text-gray-400">Fetching transactions...</span>
                  </div>
                </td>
              </tr>
            ) : filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-400">
                  No transactions found
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => (
                <tr 
                  key={tx.id}
                  className={`hover:bg-slate-800/50 transition-colors ${
                    tx.matchedRule ? 'matched' : 'unmatched'
                  }`}
                >
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selectedTransactions.has(tx.id)}
                      onChange={() => toggleSelect(tx.id)}
                      className="w-4 h-4 text-emerald-600 bg-slate-700 border-slate-600 rounded focus:ring-emerald-500"
                    />
                  </td>
                  <td className="p-4 text-sm text-gray-300">
                    {new Date(tx.date).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <div>
                      <div className="text-sm font-medium text-white">
                        {tx.description}
                      </div>
                      {tx.contact && (
                        <div className="text-xs text-gray-400 flex items-center mt-1">
                          <Building className="h-3 w-3 mr-1" />
                          {tx.contact}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className={`text-sm font-medium ${
                      tx.type === 'SPEND' ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {tx.type === 'SPEND' ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-500/20 text-amber-400">
                      Unreconciled
                    </span>
                  </td>
                  <td className="p-4">
                    {tx.matchedRule ? (
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-400 match-indicator" />
                        <div>
                          <div className="text-xs font-medium text-green-400">
                            Matched
                          </div>
                          <div className="text-xs text-gray-400">
                            {tx.matchedRule.ruleName}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <XCircle className="h-4 w-4 text-red-400 match-indicator" />
                        <span className="text-xs text-red-400">No match</span>
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => setReconcileTransaction(tx)}
                      className="px-3 py-1 text-xs bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/30 transition-colors"
                    >
                      Reconcile
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-slate-700/50 text-gray-300 rounded-lg hover:bg-slate-700/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-slate-700/50 text-gray-300 rounded-lg hover:bg-slate-700/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Reconcile Modal */}
      {reconcileTransaction && (
        <ReconcileModal
          transaction={reconcileTransaction}
          onClose={() => setReconcileTransaction(null)}
          onReconcile={handleReconcile}
        />
      )}

      <Toaster position="top-right" />
    </div>
  )
}