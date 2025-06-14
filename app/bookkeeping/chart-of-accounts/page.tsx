'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw, Search, Filter, BookOpen, Download, ChevronDown } from 'lucide-react'
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
  ytdAmount?: number
}

export default function ChartOfAccountsPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<GLAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('ALL')
  const [totalFromXero, setTotalFromXero] = useState<number | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [showYTD, setShowYTD] = useState(true)  // Show YTD by default
  const [hasYTDData, setHasYTDData] = useState(false)
  const [sortBy, setSortBy] = useState<'code' | 'name' | 'type' | 'ytd'>('code')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  
  // Column filter states
  const [codeFilter, setCodeFilter] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  
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
    fetchAccounts(showYTD)
  }, [showYTD])

  // Auto re-sync when showArchived changes
  useEffect(() => {
    if (accounts.length > 0 && !loading) {
      // Only sync if we already have accounts (not on first load) and not currently loading
      const hasArchivedInDb = accounts.some(a => a.status !== 'ACTIVE')
      if (showArchived && !hasArchivedInDb) {
        // User wants to see archived but we don't have any - sync them
        syncAccounts()
      }
    }
  }, [showArchived, loading])

  const fetchAccounts = async (includeYTD = false) => {
    try {
      setLoading(true)
      
      // First get all accounts
      const syncResponse = await fetch('/api/v1/xero/sync-gl-accounts', {
        credentials: 'include'
      })
      
      if (!syncResponse.ok) {
        throw new Error('Failed to fetch accounts')
      }
      
      const syncData = await syncResponse.json()
      const allAccounts = syncData.accounts || []
      
      // If showYTD is enabled, fetch YTD data using account-transactions-ytd endpoint
      if (includeYTD || showYTD) {
        console.log('Fetching YTD data using account-transactions-ytd endpoint...')
        const ytdResponse = await fetch('/api/v1/xero/account-transactions-ytd', {
          credentials: 'include'
        })
        
        if (ytdResponse.ok) {
          const ytdData = await ytdResponse.json()
          
          // Create maps for account matching by ID and code
          const idMap = new Map()
          const codeMap = new Map()
          
          // Map accounts by their ID and code for fast lookup
          ytdData.accounts?.forEach((acc: any) => {
            if (acc.accountID) {
              idMap.set(acc.accountID, acc.balance || 0)
            }
            if (acc.code) {
              codeMap.set(acc.code.toLowerCase(), acc.balance || 0)
            }
            
            // Log VAT and system accounts
            if (acc.code === '820' || acc.code === '825' || acc.name?.includes('VAT')) {
              console.log(`System account from Xero: ${acc.name} (${acc.code}) - Balance: ${acc.balance}`)
            }
          })
          
          // Update accounts with actual balance data
          const accountsWithYTD = allAccounts.map((account: any) => {
            let ytdAmount = 0
            
            // First priority: match by account ID
            if (account.accountId && idMap.has(account.accountId)) {
              ytdAmount = idMap.get(account.accountId)
            }
            // Second priority: match by code
            else if (account.code && codeMap.has(account.code.toLowerCase())) {
              ytdAmount = codeMap.get(account.code.toLowerCase())
            }
            
            // Special logging for VAT and system accounts
            if (account.code === '820' || account.code === '825' || account.name?.includes('VAT') || account.systemAccount) {
              console.log(`System account mapping: ${account.name} (${account.code}) => Balance: ${ytdAmount}`)
            }
            
            return {
              ...account,
              ytdAmount
            }
          })
          
          setAccounts(accountsWithYTD)
          setHasYTDData(true)
          
          // Count accounts with non-zero balances
          const accountsWithData = accountsWithYTD.filter((a: any) => a.ytdAmount !== 0).length
          const vatAccounts = accountsWithYTD.filter((a: any) => a.code === '820' || a.code === '825' || a.name?.includes('VAT'))
          
          console.log('VAT accounts after mapping:', vatAccounts)
          
          toast.success(`Loaded ${allAccounts.length} accounts (${accountsWithData} with balances)`)
        } else {
          // Try fallback to trial balance if new endpoint fails
          console.log('Failed to fetch from account-transactions-ytd, trying trial-balance-all...')
          const trialBalanceResponse = await fetch('/api/v1/xero/trial-balance-all', {
            credentials: 'include'
          })
          
          if (trialBalanceResponse.ok) {
            const trialData = await trialBalanceResponse.json()
            const codeMap = new Map()
            
            trialData.accounts?.forEach((acc: any) => {
              if (acc.accountCode) {
                codeMap.set(acc.accountCode.toLowerCase(), acc.ytdAmount)
              }
            })
            
            const accountsWithYTD = allAccounts.map((account: any) => {
              let ytdAmount = 0
              if (account.code && codeMap.has(account.code.toLowerCase())) {
                ytdAmount = codeMap.get(account.code.toLowerCase())
              }
              return { ...account, ytdAmount }
            })
            
            setAccounts(accountsWithYTD)
            setHasYTDData(true)
            toast.success(`Loaded ${allAccounts.length} accounts from Trial Balance`)
          } else {
            // Both endpoints failed, show accounts without YTD
            console.log('Failed to fetch YTD data from both endpoints')
            setAccounts(allAccounts)
            setHasYTDData(false)
            toast('Showing accounts without YTD amounts')
          }
        }
      } else {
        // Not showing YTD, just load accounts without YTD
        setAccounts(allAccounts)
        setHasYTDData(false)
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
      toast.error('Failed to fetch accounts')
    } finally {
      setLoading(false)
    }
  }


  const filteredAndSortedAccounts = accounts
    .filter(account => {
      // Code filter
      const matchesCode = !codeFilter || 
        (account.code || '').toLowerCase().includes(codeFilter.toLowerCase())
      
      // Name filter
      const matchesName = !nameFilter || 
        (account.name || '').toLowerCase().includes(nameFilter.toLowerCase())
      
      // Type filter
      const matchesType = typeFilter === 'ALL' || account.type === typeFilter
      
      // Status filter
      const matchesStatus = statusFilter === 'ALL' || 
        (statusFilter === 'ACTIVE' && account.status === 'ACTIVE') ||
        (statusFilter === 'ARCHIVED' && account.status !== 'ACTIVE')
      
      return matchesCode && matchesName && matchesType && matchesStatus
    })
    .sort((a, b) => {
      let compareValue = 0
      
      switch (sortBy) {
        case 'code':
          // For codes, put N/A or empty at the end
          const aCode = a.code || 'ZZZ'
          const bCode = b.code || 'ZZZ'
          compareValue = aCode.localeCompare(bCode)
          break
        case 'name':
          compareValue = (a.name || '').localeCompare(b.name || '')
          break
        case 'type':
          compareValue = (a.type || '').localeCompare(b.type || '')
          break
        case 'ytd':
          compareValue = (a.ytdAmount || 0) - (b.ytdAmount || 0)
          break
      }
      
      return sortOrder === 'asc' ? compareValue : -compareValue
    })

  const handleSort = (field: 'code' | 'name' | 'type' | 'ytd') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
    }
  }

  const accountTypes = [...new Set(accounts.map(acc => acc.type))].sort()
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeDropdown && !(e.target as Element).closest('.filter-dropdown')) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [activeDropdown])

  const exportToCSV = () => {
    const headers = showYTD 
      ? ['Code', 'Name', 'Type', 'YTD Amount', 'Description', 'Status']
      : ['Code', 'Name', 'Type', 'Description', 'Status']
    
    const rows = filteredAndSortedAccounts.map(acc => {
      const baseRow = [
        acc.code,
        acc.name,
        acc.type,
        acc.description || '',
        acc.status
      ]
      
      if (showYTD) {
        baseRow.splice(3, 0, (acc.ytdAmount || 0).toString())
      }
      
      return baseRow
    })
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chart-of-accounts-${showYTD ? 'with-ytd-' : ''}${new Date().toISOString().split('T')[0]}.csv`
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
              Showing {filteredAndSortedAccounts.length} of {accounts.length} accounts
              {totalFromXero && ` (${totalFromXero} available in Xero)`}
            </p>
          </div>
          
          <div className="flex gap-3 items-center">
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


      {/* Summary Stats */}
      {!loading && accounts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
            <div className="text-2xl font-bold text-white">{accounts.length}</div>
            <div className="text-sm text-gray-400">Total Accounts</div>
          </div>
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
            <div className="text-2xl font-bold text-green-400">
              {accounts.filter(a => a.status === 'ACTIVE').length}
            </div>
            <div className="text-sm text-gray-400">Active Accounts</div>
          </div>
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
            <div className="text-2xl font-bold text-amber-400">
              {accountTypes.length}
            </div>
            <div className="text-sm text-gray-400">Account Types</div>
          </div>
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
            <div className="text-2xl font-bold text-blue-400">
              {accounts.filter(a => a.systemAccount).length}
            </div>
            <div className="text-sm text-gray-400">System Accounts</div>
          </div>
        </div>
      )}

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
            Go to the bookkeeping dashboard and click &quot;Sync All Data&quot; to import your Chart of Accounts
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Table Header */}
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-t-xl px-6 py-4 grid grid-cols-12 gap-4 text-xs font-medium text-gray-400 uppercase tracking-wider">
            {/* Code Column */}
            <div className="col-span-2">
              <div className="flex items-center justify-between">
                <div 
                  className="cursor-pointer hover:text-white flex items-center gap-1"
                  onClick={() => handleSort('code')}
                >
                  Code
                  {sortBy === 'code' && (
                    <span className="text-amber-400">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
                <div className="relative filter-dropdown">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveDropdown(activeDropdown === 'code' ? null : 'code')
                    }}
                    className="p-1 hover:bg-slate-700/50 rounded"
                  >
                    <Filter className="h-3 w-3" />
                  </button>
                  {activeDropdown === 'code' && (
                    <div className="absolute top-full right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50 w-48">
                      <input
                        type="text"
                        placeholder="Filter codes..."
                        value={codeFilter}
                        onChange={(e) => setCodeFilter(e.target.value)}
                        className="w-full px-3 py-2 bg-transparent text-white text-sm border-b border-slate-700 focus:outline-none focus:border-amber-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Name Column */}
            <div className="col-span-3">
              <div className="flex items-center justify-between">
                <div 
                  className="cursor-pointer hover:text-white flex items-center gap-1"
                  onClick={() => handleSort('name')}
                >
                  Account Name
                  {sortBy === 'name' && (
                    <span className="text-amber-400">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
                <div className="relative filter-dropdown">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveDropdown(activeDropdown === 'name' ? null : 'name')
                    }}
                    className="p-1 hover:bg-slate-700/50 rounded"
                  >
                    <Filter className="h-3 w-3" />
                  </button>
                  {activeDropdown === 'name' && (
                    <div className="absolute top-full right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50 w-48">
                      <input
                        type="text"
                        placeholder="Filter names..."
                        value={nameFilter}
                        onChange={(e) => setNameFilter(e.target.value)}
                        className="w-full px-3 py-2 bg-transparent text-white text-sm border-b border-slate-700 focus:outline-none focus:border-amber-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Type Column */}
            <div className="col-span-2">
              <div className="flex items-center justify-between">
                <div 
                  className="cursor-pointer hover:text-white flex items-center gap-1"
                  onClick={() => handleSort('type')}
                >
                  Type
                  {sortBy === 'type' && (
                    <span className="text-amber-400">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
                <div className="relative filter-dropdown">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveDropdown(activeDropdown === 'type' ? null : 'type')
                    }}
                    className="p-1 hover:bg-slate-700/50 rounded"
                  >
                    <Filter className="h-3 w-3" />
                  </button>
                  {activeDropdown === 'type' && (
                    <div className="absolute top-full right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50 w-48 max-h-64 overflow-y-auto">
                      <button
                        onClick={() => setTypeFilter('ALL')}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 ${
                          typeFilter === 'ALL' ? 'text-amber-400' : 'text-gray-300'
                        }`}
                      >
                        All Types
                      </button>
                      {accountTypes.map(type => (
                        <button
                          key={type}
                          onClick={() => setTypeFilter(type)}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 ${
                            typeFilter === type ? 'text-amber-400' : 'text-gray-300'
                          }`}
                        >
                          {typeLabels[type] || type}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* YTD Amount Column */}
            <div className="col-span-2">
              <div 
                className="text-right cursor-pointer hover:text-white flex items-center justify-end gap-1"
                onClick={() => handleSort('ytd')}
              >
                YTD Amount
                {sortBy === 'ytd' && (
                  <span className="text-amber-400">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </div>
            </div>
            
            {/* Description Column */}
            <div className="col-span-2">Description</div>
            
            {/* Status Column */}
            <div className="col-span-1">
              <div className="flex items-center justify-center">
                <span>Status</span>
                <div className="relative filter-dropdown ml-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveDropdown(activeDropdown === 'status' ? null : 'status')
                    }}
                    className="p-1 hover:bg-slate-700/50 rounded"
                  >
                    <Filter className="h-3 w-3" />
                  </button>
                  {activeDropdown === 'status' && (
                    <div className="absolute top-full right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50 w-32">
                      <button
                        onClick={() => setStatusFilter('ALL')}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 ${
                          statusFilter === 'ALL' ? 'text-amber-400' : 'text-gray-300'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setStatusFilter('ACTIVE')}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 ${
                          statusFilter === 'ACTIVE' ? 'text-amber-400' : 'text-gray-300'
                        }`}
                      >
                        Active
                      </button>
                      <button
                        onClick={() => setStatusFilter('ARCHIVED')}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 ${
                          statusFilter === 'ARCHIVED' ? 'text-amber-400' : 'text-gray-300'
                        }`}
                      >
                        Archived
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Table Body */}
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-b-xl divide-y divide-slate-700/30">
            {filteredAndSortedAccounts.map((account, index) => (
              <div 
                key={account.id} 
                className="px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-slate-800/50 transition-all duration-200 group"
              >
                <div className="col-span-2">
                  <div className="text-sm font-mono font-medium text-amber-400">
                    {account.code || (account.type === 'BANK' ? 'BANK' : 'N/A')}
                  </div>
                </div>
                <div className="col-span-3">
                  <div className="text-sm font-medium text-white group-hover:text-amber-300 transition-colors">
                    {account.name}
                  </div>
                  {account.systemAccount && (
                    <div className="text-xs text-gray-500 mt-0.5">System Account</div>
                  )}
                </div>
                <div className="col-span-2">
                  <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                    account.type === 'REVENUE' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                    account.type === 'EXPENSE' || account.type === 'OVERHEADS' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    account.type === 'DIRECTCOSTS' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                    account.type === 'CURRENT' || account.type === 'FIXED' || account.type === 'INVENTORY' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    account.type === 'CURRLIAB' || account.type === 'TERMLIAB' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                    account.type === 'EQUITY' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                    account.type === 'OTHERINCOME' ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' :
                    'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                  }`}>
                    {typeLabels[account.type] || account.type}
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  {account.ytdAmount !== undefined && account.ytdAmount !== 0 ? (
                    <div className={`text-sm font-medium ${
                      account.ytdAmount < 0 ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {new Intl.NumberFormat('en-GB', {
                        style: 'currency',
                        currency: 'GBP',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      }).format(Math.abs(account.ytdAmount))}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-500">-</span>
                  )}
                </div>
                <div className="col-span-2">
                  <div className="text-sm text-gray-400 truncate" title={account.description || ''}>
                    {account.description || '-'}
                  </div>
                </div>
                <div className="col-span-1 text-center">
                  {account.status === 'ACTIVE' ? (
                    <span className="inline-flex w-2 h-2 bg-green-400 rounded-full" title="Active"></span>
                  ) : (
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-500/20 text-gray-400">
                      Archived
                    </span>
                  )}
                </div>
              </div>
            ))}
            
            {filteredAndSortedAccounts.length === 0 && (
              <div className="px-6 py-12 text-center">
                <p className="text-gray-400">No accounts match your search criteria</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}