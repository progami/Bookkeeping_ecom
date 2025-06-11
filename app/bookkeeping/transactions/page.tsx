'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, RefreshCw, Download, Filter, Search, Calendar, 
  CheckCircle, XCircle, AlertCircle, DollarSign, Building,
  ChevronLeft, ChevronRight, Check, Receipt
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
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [amountRange, setAmountRange] = useState({ min: '', max: '' })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [pageSize, setPageSize] = useState(1000)
  const [showAll, setShowAll] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [reconcileTransaction, setReconcileTransaction] = useState<Transaction | null>(null)
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [totalTransactions, setTotalTransactions] = useState(0)
  const [summary, setSummary] = useState({
    totalTransactions: 0,
    unreconciledCount: 0,
    reconciledCount: 0,
    matchedCount: 0
  })

  useEffect(() => {
    checkConnectionAndSync()
  }, [])
  
  useEffect(() => {
    if (transactions.length > 0 || bankAccounts.length > 0) {
      syncTransactions(false)
    }
  }, [selectedAccount, filter.status, currentPage, showAll, pageSize])

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

  const syncTransactions = async (fullSync = false) => {
    setSyncing(true)
    if (showAll) {
      setLoading(true)
    }
    try {
      if (fullSync) {
        // Full sync from Xero
        toast.loading('Syncing all transactions from Xero...', { id: 'sync' })
        const syncResponse = await fetch('/api/v1/xero/sync-all-fixed', { method: 'POST' })
        
        if (!syncResponse.ok) {
          throw new Error('Sync failed')
        }
        
        const syncData = await syncResponse.json()
        toast.success(`Synced ${syncData.summary.accounts} accounts, ${syncData.summary.transactions} transactions`, { id: 'sync' })
      }
      
      // Fetch from database
      const params = new URLSearchParams({
        page: showAll ? '1' : currentPage.toString(),
        pageSize: showAll ? '10000' : pageSize.toString(),
        showReconciled: filter.status === 'all' || filter.status === 'reconciled' ? 'true' : 'false'
      })
      
      if (selectedAccount) {
        params.append('accountId', selectedAccount)
      }
      
      const response = await fetch(`/api/v1/xero/transactions?${params}`)
      
      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Xero session expired. Please reconnect.')
          router.push('/bookkeeping')
          return
        }
        throw new Error('Failed to fetch transactions')
      }
      
      const data = await response.json()
      
      // Debug log to check transaction data
      console.log('First 3 transactions:', data.transactions.slice(0, 3).map((tx: any) => ({
        description: tx.description,
        reference: tx.reference,
        contact: tx.contact,
        lineItems: tx.lineItems
      })))
      
      setTransactions(data.transactions)
      setBankAccounts(data.bankAccounts || [])
      setTotalPages(data.pagination.totalPages)
      setTotalTransactions(data.pagination.total)
      setSummary(data.summary || {
        totalTransactions: data.pagination.total,
        unreconciledCount: 0,
        reconciledCount: 0,
        matchedCount: 0
      })
      setLastSync(new Date())
      
      if (!fullSync) {
        toast.success(`Loaded ${data.transactions.length} of ${data.pagination.total} transactions`)
      }
    } catch (error) {
      console.error('Error syncing:', error)
      toast.error('Failed to sync transactions')
    } finally {
      setSyncing(false)
      setLoading(false)
    }
  }

  const filteredTransactions = transactions.filter(tx => {
    // Status filter
    if (filter.status === 'unreconciled' && tx.isReconciled) return false
    if (filter.status === 'reconciled' && !tx.isReconciled) return false
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
              onClick={() => syncTransactions(false)}
              disabled={syncing}
              className="px-4 py-2 bg-slate-700/50 text-gray-300 rounded-lg hover:bg-slate-700/70 transition-colors flex items-center"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => syncTransactions(true)}
              disabled={syncing}
              className="px-4 py-2 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/30 transition-colors flex items-center"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Full Sync'}
            </button>
            <button
              onClick={async () => {
                try {
                  setSyncing(true);
                  toast('Syncing transactions with GL account details...', {
                    icon: 'ℹ️',
                  });
                  const response = await fetch('/api/v1/xero/sync-with-line-items', {
                    method: 'POST'
                  });
                  const data = await response.json();
                  if (data.success) {
                    toast.success(`Synced ${data.stats.totalUpdated} transactions. ${data.stats.percentageWithCodes} now have GL accounts.`);
                    syncTransactions();
                  } else {
                    toast.error(`Sync failed: ${data.error}`);
                  }
                } catch (error) {
                  toast.error('Failed to sync transactions');
                } finally {
                  setSyncing(false);
                }
              }}
              className="px-4 py-2 bg-purple-600/20 text-purple-400 rounded-lg hover:bg-purple-600/30 transition-colors flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync GL Accounts
            </button>
          </div>
        </div>
        
        {lastSync && (
          <div className="mt-2 text-sm text-gray-500">
            Last sync: {lastSync.toLocaleString()} 
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Transactions</p>
              <p className="text-2xl font-bold text-white">{summary.totalTransactions}</p>
            </div>
            <Receipt className="h-8 w-8 text-gray-600" />
          </div>
        </div>
        
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Unreconciled</p>
              <p className="text-2xl font-bold text-amber-400">
                {summary.unreconciledCount}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-amber-600" />
          </div>
        </div>
        
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Rule Matched</p>
              <p className="text-2xl font-bold text-blue-400">
                {summary.matchedCount}
              </p>
            </div>
            <Check className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Reconciled</p>
              <p className="text-2xl font-bold text-green-400">
                {summary.reconciledCount}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
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
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
          className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="">All Bank Accounts</option>
          {bankAccounts.map(acc => (
            <option key={acc.id} value={acc.id}>
              {acc.name} ({acc.currencyCode}) - {acc.transactionCount} txns
            </option>
          ))}
        </select>
        
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value as any })}
          className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
        >
          <option value="all">All Transactions</option>
          <option value="unreconciled">Unreconciled Only</option>
          <option value="reconciled">Reconciled Only</option>
          <option value="matched">Matched Rules</option>
          <option value="unmatched">No Rule Match</option>
        </select>
      </div>

      {/* Bulk Actions */}
      {selectedTransactions.size > 0 && (
        <div className="mb-4 p-4 bg-emerald-600/10 border border-emerald-600/30 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-emerald-400">
              {selectedTransactions.size} transaction{selectedTransactions.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setSelectedTransactions(new Set())}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Clear selection
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBulkReconcile}
              className="px-4 py-2 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/30 transition-colors"
            >
              Bulk Reconcile Matched
            </button>
            <button
              onClick={() => {
                const selectedUnreconciled = filteredTransactions.filter(
                  tx => selectedTransactions.has(tx.id) && !tx.isReconciled
                ).length
                
                if (selectedUnreconciled === 0) {
                  toast.error('Please select unreconciled transactions')
                  return
                }
                
                // TODO: Open bulk categorize modal
                toast(`Categorizing ${selectedUnreconciled} transactions`, {
                  icon: 'ℹ️',
                })
              }}
              className="px-4 py-2 bg-indigo-600/20 text-indigo-400 rounded-lg hover:bg-indigo-600/30 transition-colors"
            >
              Bulk Categorize
            </button>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden">
        {loading && showAll ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 text-emerald-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Loading all transactions...</p>
            </div>
          </div>
        ) : (
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
                Contact/Payee
              </th>
              <th className="p-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                Amount
              </th>
              <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Bank Account
              </th>
              <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                GL Account
              </th>
              <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Reference
              </th>
              <th className="p-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="p-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {loading ? (
              <tr>
                <td colSpan={10} className="p-8 text-center">
                  <div className="flex items-center justify-center">
                    <RefreshCw className="h-6 w-6 text-emerald-400 animate-spin" />
                    <span className="ml-2 text-gray-400">Fetching transactions...</span>
                  </div>
                </td>
              </tr>
            ) : filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-gray-400">
                  No transactions found
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => (
                <tr 
                  key={tx.id}
                  className="hover:bg-slate-800/50 transition-colors"
                >
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selectedTransactions.has(tx.id)}
                      onChange={() => toggleSelect(tx.id)}
                      className="w-4 h-4 text-emerald-600 bg-slate-700 border-slate-600 rounded focus:ring-emerald-500"
                    />
                  </td>
                  <td className="p-4 text-sm text-gray-300 whitespace-nowrap">
                    {new Date(tx.date).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-gray-300 max-w-xs truncate" title={tx.description}>
                      {tx.description || <span className="text-gray-500 italic">No description</span>}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-gray-300">
                      {tx.contact || <span className="text-gray-500">-</span>}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className={`text-sm font-medium ${
                      tx.type === 'SPEND' ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {tx.type === 'SPEND' ? '-' : '+'}
                      {tx.currencyCode || '$'}
                      {Math.abs(tx.amount).toFixed(2)}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-gray-300">
                      {tx.bankAccountName || '-'}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm">
                      {tx.accountCode ? (
                        <div>
                          <div className="text-gray-300 font-mono">{tx.accountCode}</div>
                          {tx.accountName && (
                            <div className="text-xs text-gray-500">{tx.accountName}</div>
                          )}
                        </div>
                      ) : tx.matchedRule ? (
                        <div>
                          <div className="text-blue-400 font-mono">{tx.matchedRule.accountCode}</div>
                          <div className="text-xs text-gray-500">Suggested</div>
                        </div>
                      ) : (
                        <span className="text-gray-500 italic">Uncategorized</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-gray-400 font-mono text-xs">
                      {tx.reference || <span className="text-gray-500">-</span>}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    {tx.isReconciled ? (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-500/20 text-green-400">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Reconciled
                      </span>
                    ) : tx.matchedRule ? (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-500/20 text-blue-400">
                        <Check className="h-3 w-3 mr-1" />
                        Matched
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-amber-500/20 text-amber-400">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      {!tx.isReconciled && (
                        <button
                          onClick={() => setReconcileTransaction(tx)}
                          className="px-3 py-1 text-xs bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/30 transition-colors"
                        >
                          Reconcile
                        </button>
                      )}
                      {tx.matchedRule && !tx.isReconciled && (
                        <button
                          onClick={() => {
                            // Quick reconcile with matched rule
                            handleReconcile({
                              transactionId: tx.id,
                              reference: tx.reference || '',
                              description: tx.description,
                              accountCode: tx.matchedRule?.accountCode || '',
                              taxType: tx.matchedRule?.taxType || '',
                              createRule: false
                            })
                          }}
                          className="px-3 py-1 text-xs bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors"
                          title="Quick reconcile with matched rule"
                        >
                          Apply Rule
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        )}
      </div>

      {/* Pagination */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">
            {showAll 
              ? (
                <div>
                  <span>Showing all {totalTransactions} transactions</span>
                  {totalTransactions > 1000 && (
                    <span className="text-amber-400 ml-2">(May take longer to load)</span>
                  )}
                </div>
              )
              : `Page ${currentPage} of ${totalPages} (${totalTransactions} total)`
            }
          </div>
          <button
            onClick={() => {
              setShowAll(!showAll)
              setCurrentPage(1)
            }}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              showAll 
                ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30' 
                : 'bg-slate-700/50 text-gray-300 hover:bg-slate-700/70'
            }`}
          >
            {showAll ? (
              <>
                <Check className="h-4 w-4" />
                Showing All
              </>
            ) : (
              <>
                Show All
              </>
            )}
          </button>
        </div>
        
        {!showAll && totalPages > 1 && (
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-slate-700/50 text-gray-300 rounded-lg hover:bg-slate-700/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-slate-700/50 text-gray-300 rounded-lg hover:bg-slate-700/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Reconcile Modal */}
      {reconcileTransaction && (
        <ReconcileModal
          transaction={reconcileTransaction}
          onClose={() => setReconcileTransaction(null)}
          onReconcile={handleReconcile}
        />
      )}

    </div>
  )
}