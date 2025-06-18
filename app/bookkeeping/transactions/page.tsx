'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw, Download, Filter, Search, Calendar, DollarSign, Building2, Hash, CheckCircle, XCircle } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

interface BankTransaction {
  id: string
  xeroTransactionId: string
  bankAccountId: string
  date: string
  amount: number
  currencyCode?: string
  type: string
  status: string
  isReconciled: boolean
  reference?: string
  description?: string
  contactName?: string
  lineItems?: string
  hasAttachments: boolean
  accountCode?: string
  taxType?: string
  createdAt: string
  updatedAt: string
  lastSyncedAt: string
  bankAccount?: {
    name: string
    code?: string
  }
}

export default function TransactionsPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('ALL')
  const [filterReconciled, setFilterReconciled] = useState('ALL')
  const [filterAccount, setFilterAccount] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalTransactions, setTotalTransactions] = useState(0)
  const pageSize = 50

  useEffect(() => {
    fetchTransactions()
  }, [currentPage])

  const fetchTransactions = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString()
      })

      const response = await fetch(`/api/v1/bookkeeping/bank-transactions?${params.toString()}`)
      
      if (response.ok) {
        const data = await response.json()
        setTransactions(data.transactions || [])
        setTotalPages(data.totalPages || 1)
        setTotalTransactions(data.total || 0)
      } else {
        toast.error('Failed to fetch transactions')
        setTransactions([])
      }
    } catch (error) {
      console.error('Error fetching transactions:', error)
      toast.error('Error loading transactions')
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }


  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = 
      (transaction.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (transaction.contactName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (transaction.reference || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = filterType === 'ALL' || transaction.type === filterType
    const matchesReconciled = 
      filterReconciled === 'ALL' || 
      (filterReconciled === 'RECONCILED' && transaction.isReconciled) ||
      (filterReconciled === 'UNRECONCILED' && !transaction.isReconciled)
    
    const matchesAccount = 
      filterAccount === 'ALL' || 
      transaction.bankAccount?.name === filterAccount

    const transactionDate = new Date(transaction.date)
    const matchesDateFrom = !dateFrom || transactionDate >= new Date(dateFrom)
    const matchesDateTo = !dateTo || transactionDate <= new Date(dateTo)
    
    return matchesSearch && matchesType && matchesReconciled && matchesAccount && matchesDateFrom && matchesDateTo
  })

  const bankAccounts = [...new Set(transactions.map(t => t.bankAccount?.name).filter(Boolean))]

  const exportToCSV = () => {
    const headers = ['Date', 'Description', 'Contact', 'Type', 'Amount', 'Account', 'Status', 'Reconciled']
    const rows = filteredTransactions.map(t => [
      new Date(t.date).toLocaleDateString(),
      t.description || '',
      t.contactName || '',
      t.type,
      t.amount.toFixed(2),
      t.bankAccount?.name || '',
      t.status,
      t.isReconciled ? 'Yes' : 'No'
    ])
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Bank Transactions</h1>
            <p className="text-gray-400">
              Showing {filteredTransactions.length} of {totalTransactions} transactions
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-slate-800/50 text-gray-300 rounded-lg hover:bg-slate-800/70 transition-colors flex items-center gap-2 border border-slate-700"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 bg-slate-800/50 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="ALL">All Types</option>
          <option value="SPEND">Spend</option>
          <option value="RECEIVE">Receive</option>
        </select>

        <select
          value={filterReconciled}
          onChange={(e) => setFilterReconciled(e.target.value)}
          className="px-4 py-2 bg-slate-800/50 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="ALL">All Status</option>
          <option value="RECONCILED">Reconciled</option>
          <option value="UNRECONCILED">Unreconciled</option>
        </select>

        <select
          value={filterAccount}
          onChange={(e) => setFilterAccount(e.target.value)}
          className="px-4 py-2 bg-slate-800/50 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="ALL">All Accounts</option>
          {bankAccounts.map(account => (
            <option key={account} value={account}>{account}</option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          placeholder="From date"
          className="px-4 py-2 bg-slate-800/50 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />

        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          placeholder="To date"
          className="px-4 py-2 bg-slate-800/50 text-white border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Transactions Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-12 text-center">
          <DollarSign className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No transactions found</h3>
          <p className="text-gray-400 mb-6">
            {transactions.length === 0 
              ? "Sync from Xero to import your bank transactions" 
              : "Try adjusting your filters"}
          </p>
          {transactions.length === 0 && (
            <button
              onClick={() => router.push('/bookkeeping')}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Go to Dashboard
            </button>
          )}
        </div>
      ) : (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50 border-b border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                        {new Date(transaction.date).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-white">
                      <div className="max-w-xs truncate" title={transaction.description}>
                        {transaction.description || '-'}
                      </div>
                      {transaction.reference && (
                        <div className="text-xs text-gray-500 mt-1">Ref: {transaction.reference}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      <div className="flex items-center">
                        <Building2 className="h-4 w-4 mr-2 text-gray-500" />
                        {transaction.contactName || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        transaction.type === 'SPEND' 
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                          : 'bg-green-500/20 text-green-400 border border-green-500/30'
                      }`}>
                        {transaction.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono">
                      <span className={transaction.type === 'SPEND' ? 'text-red-400' : 'text-green-400'}>
                        {transaction.type === 'SPEND' ? '-' : '+'}
                        {Math.abs(transaction.amount).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {transaction.bankAccount?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      {transaction.isReconciled ? (
                        <CheckCircle className="h-5 w-5 text-green-400 mx-auto" />
                      ) : (
                        <XCircle className="h-5 w-5 text-gray-500 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-slate-900/50 border-t border-slate-700 flex items-center justify-between">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-slate-800 text-gray-300 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-gray-400">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-slate-800 text-gray-300 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}