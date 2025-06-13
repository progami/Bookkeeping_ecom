'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, Database, Table, Hash, Calendar, 
  ToggleLeft, Type, FileText, Key, RefreshCw
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

interface TableInfo {
  name: string
  recordCount: number
  columns: Array<{
    name: string
    type: string
    isPrimary: boolean
    isOptional: boolean
  }>
  lastUpdated?: string
}

const SCHEMA_INFO = {
  GLAccount: {
    description: 'Chart of Accounts from Xero',
    icon: '📊',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'code', type: 'String', isPrimary: false, isOptional: false },
      { name: 'name', type: 'String', isPrimary: false, isOptional: false },
      { name: 'type', type: 'String', isPrimary: false, isOptional: false },
      { name: 'status', type: 'String', isPrimary: false, isOptional: true },
      { name: 'description', type: 'String', isPrimary: false, isOptional: true },
      { name: 'systemAccount', type: 'Boolean', isPrimary: false, isOptional: false },
      { name: 'class', type: 'String', isPrimary: false, isOptional: true },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'updatedAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  BankAccount: {
    description: 'Bank accounts synced from Xero',
    icon: '🏦',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'xeroAccountId', type: 'String', isPrimary: false, isOptional: false },
      { name: 'name', type: 'String', isPrimary: false, isOptional: false },
      { name: 'code', type: 'String', isPrimary: false, isOptional: true },
      { name: 'currencyCode', type: 'String', isPrimary: false, isOptional: true },
      { name: 'balance', type: 'Float', isPrimary: false, isOptional: false },
      { name: 'balanceLastUpdated', type: 'DateTime', isPrimary: false, isOptional: true },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'updatedAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  BankTransaction: {
    description: 'Bank transactions with categorization',
    icon: '💳',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'xeroTransactionId', type: 'String', isPrimary: false, isOptional: false },
      { name: 'bankAccountId', type: 'String', isPrimary: false, isOptional: false },
      { name: 'date', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'amount', type: 'Float', isPrimary: false, isOptional: false },
      { name: 'type', type: 'String', isPrimary: false, isOptional: false },
      { name: 'status', type: 'String', isPrimary: false, isOptional: false },
      { name: 'isReconciled', type: 'Boolean', isPrimary: false, isOptional: false },
      { name: 'contactName', type: 'String', isPrimary: false, isOptional: true },
      { name: 'description', type: 'String', isPrimary: false, isOptional: true },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  SyncLog: {
    description: 'History of data synchronization operations',
    icon: '🔄',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'syncType', type: 'String', isPrimary: false, isOptional: false },
      { name: 'status', type: 'String', isPrimary: false, isOptional: false },
      { name: 'startedAt', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'completedAt', type: 'DateTime', isPrimary: false, isOptional: true },
      { name: 'recordsCreated', type: 'Int', isPrimary: false, isOptional: false },
      { name: 'recordsUpdated', type: 'Int', isPrimary: false, isOptional: false },
      { name: 'errorMessage', type: 'String', isPrimary: false, isOptional: true }
    ]
  },
  StandardOperatingProcedure: {
    description: 'SOP templates for bookkeeping',
    icon: '📋',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'year', type: 'String', isPrimary: false, isOptional: false },
      { name: 'chartOfAccount', type: 'String', isPrimary: false, isOptional: false },
      { name: 'pointOfInvoice', type: 'String', isPrimary: false, isOptional: true },
      { name: 'serviceType', type: 'String', isPrimary: false, isOptional: false },
      { name: 'referenceTemplate', type: 'String', isPrimary: false, isOptional: false },
      { name: 'descriptionTemplate', type: 'String', isPrimary: false, isOptional: false },
      { name: 'isActive', type: 'Boolean', isPrimary: false, isOptional: false },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  SyncedInvoice: {
    description: 'Invoices synced from Xero for cash flow',
    icon: '📄',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'contactId', type: 'String', isPrimary: false, isOptional: false },
      { name: 'contactName', type: 'String', isPrimary: false, isOptional: true },
      { name: 'invoiceNumber', type: 'String', isPrimary: false, isOptional: true },
      { name: 'dueDate', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'amountDue', type: 'Float', isPrimary: false, isOptional: false },
      { name: 'total', type: 'Float', isPrimary: false, isOptional: false },
      { name: 'type', type: 'String', isPrimary: false, isOptional: false },
      { name: 'status', type: 'String', isPrimary: false, isOptional: false },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  RepeatingTransaction: {
    description: 'Recurring invoices and bills',
    icon: '🔁',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'type', type: 'String', isPrimary: false, isOptional: false },
      { name: 'contactName', type: 'String', isPrimary: false, isOptional: true },
      { name: 'scheduleUnit', type: 'String', isPrimary: false, isOptional: false },
      { name: 'scheduleInterval', type: 'Int', isPrimary: false, isOptional: false },
      { name: 'nextScheduledDate', type: 'DateTime', isPrimary: false, isOptional: true },
      { name: 'amount', type: 'Float', isPrimary: false, isOptional: false },
      { name: 'status', type: 'String', isPrimary: false, isOptional: false },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  CashFlowBudget: {
    description: 'Monthly budget tracking',
    icon: '💰',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'accountCode', type: 'String', isPrimary: false, isOptional: false },
      { name: 'accountName', type: 'String', isPrimary: false, isOptional: false },
      { name: 'category', type: 'String', isPrimary: false, isOptional: false },
      { name: 'monthYear', type: 'String', isPrimary: false, isOptional: false },
      { name: 'budgetedAmount', type: 'Float', isPrimary: false, isOptional: false },
      { name: 'actualAmount', type: 'Float', isPrimary: false, isOptional: false },
      { name: 'variance', type: 'Float', isPrimary: false, isOptional: false },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  CashFlowForecast: {
    description: 'Cash flow predictions',
    icon: '📈',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'date', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'openingBalance', type: 'Float', isPrimary: false, isOptional: false },
      { name: 'totalInflows', type: 'Float', isPrimary: false, isOptional: false },
      { name: 'totalOutflows', type: 'Float', isPrimary: false, isOptional: false },
      { name: 'closingBalance', type: 'Float', isPrimary: false, isOptional: false },
      { name: 'confidenceLevel', type: 'Float', isPrimary: false, isOptional: false },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  PaymentPattern: {
    description: 'Customer and supplier payment behavior',
    icon: '📊',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'contactId', type: 'String', isPrimary: false, isOptional: false },
      { name: 'contactName', type: 'String', isPrimary: false, isOptional: false },
      { name: 'type', type: 'String', isPrimary: false, isOptional: false },
      { name: 'averageDaysToPay', type: 'Float', isPrimary: false, isOptional: false },
      { name: 'onTimeRate', type: 'Float', isPrimary: false, isOptional: false },
      { name: 'sampleSize', type: 'Int', isPrimary: false, isOptional: false },
      { name: 'lastCalculated', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  TaxObligation: {
    description: 'Tax payment tracking',
    icon: '🏛️',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'type', type: 'String', isPrimary: false, isOptional: false },
      { name: 'dueDate', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'amount', type: 'Float', isPrimary: false, isOptional: false },
      { name: 'status', type: 'String', isPrimary: false, isOptional: false },
      { name: 'reference', type: 'String', isPrimary: false, isOptional: true },
      { name: 'createdAt', type: 'DateTime', isPrimary: false, isOptional: false }
    ]
  },
  CashFlowSyncLog: {
    description: 'Cash flow sync history',
    icon: '🔄',
    columns: [
      { name: 'id', type: 'String', isPrimary: true, isOptional: false },
      { name: 'syncType', type: 'String', isPrimary: false, isOptional: false },
      { name: 'entityType', type: 'String', isPrimary: false, isOptional: false },
      { name: 'startedAt', type: 'DateTime', isPrimary: false, isOptional: false },
      { name: 'completedAt', type: 'DateTime', isPrimary: false, isOptional: true },
      { name: 'itemsSynced', type: 'Int', isPrimary: false, isOptional: false },
      { name: 'status', type: 'String', isPrimary: false, isOptional: false },
      { name: 'errorMessage', type: 'String', isPrimary: false, isOptional: true }
    ]
  }
}

export default function DatabaseExplorerPage() {
  const router = useRouter()
  const [tables, setTables] = useState<TableInfo[]>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tableData, setTableData] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [totalRecords, setTotalRecords] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  useEffect(() => {
    fetchTableInfo()
  }, [])

  const fetchTableInfo = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/v1/database/info')
      
      if (response.ok) {
        const data = await response.json()
        setTables(data.tables)
      } else {
        // Fallback to schema info if API not available
        const mockTables = Object.entries(SCHEMA_INFO).map(([name, info]) => ({
          name,
          recordCount: 0,
          columns: info.columns,
          lastUpdated: new Date().toISOString()
        }))
        setTables(mockTables)
      }
    } catch (error) {
      console.error('Error fetching table info:', error)
      // Use mock data
      const mockTables = Object.entries(SCHEMA_INFO).map(([name, info]) => ({
        name,
        recordCount: 0,
        columns: info.columns,
        lastUpdated: new Date().toISOString()
      }))
      setTables(mockTables)
    } finally {
      setLoading(false)
    }
  }

  const fetchTableData = async (tableName: string, limit: number = 10, append: boolean = false) => {
    try {
      setLoadingData(true)
      const offset = append ? tableData.length : 0
      console.log(`Fetching data for table: ${tableName}, limit: ${limit}, offset: ${offset}`)
      const response = await fetch(`/api/v1/database/table/${tableName}?limit=${limit}&offset=${offset}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log(`Fetched ${data.records.length} records, total: ${data.total}`)
        
        if (append) {
          setTableData(prev => [...prev, ...data.records])
        } else {
          setTableData(data.records)
        }
        
        setTotalRecords(data.total)
        setHasMore(data.hasMore)
        
        if (data.records.length === 0 && !append) {
          toast(`Table ${tableName} is empty`, {
            icon: 'ℹ️',
          })
        }
      } else {
        console.error('Response not ok:', response.status)
        toast.error('Failed to fetch table data')
        if (!append) {
          setTableData([])
        }
      }
    } catch (error) {
      console.error('Error fetching table data:', error)
      toast.error('Error loading table data')
      if (!append) {
        setTableData([])
      }
    } finally {
      setLoadingData(false)
    }
  }

  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName)
    setTableData([]) // Clear previous data
    fetchTableData(tableName, 10, false)
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'String': return <Type className="h-4 w-4 text-blue-400" />
      case 'Int':
      case 'Float': return <Hash className="h-4 w-4 text-green-400" />
      case 'Boolean': return <ToggleLeft className="h-4 w-4 text-purple-400" />
      case 'DateTime': return <Calendar className="h-4 w-4 text-amber-400" />
      default: return <FileText className="h-4 w-4 text-gray-400" />
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Toaster position="top-right" />
      
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
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center">
              <Database className="h-8 w-8 mr-3 text-teal-400" />
              Database Explorer
            </h1>
            <p className="text-gray-400">Visual database schema and data browser</p>
          </div>
          
          <button
            onClick={fetchTableInfo}
            className="px-4 py-2 bg-teal-600/20 text-teal-400 rounded-lg hover:bg-teal-600/30 transition-colors flex items-center gap-2 border border-teal-500/30"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tables List */}
        <div className="lg:col-span-1">
          <h2 className="text-xl font-semibold text-white mb-4">Database Tables</h2>
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin h-8 w-8 border-2 border-teal-500 border-t-transparent rounded-full"></div>
              </div>
            ) : (
              tables.map((table) => {
                const schemaInfo = SCHEMA_INFO[table.name as keyof typeof SCHEMA_INFO]
                return (
                  <div
                    key={table.name}
                    onClick={() => handleTableSelect(table.name)}
                    className={`p-4 bg-slate-800/30 border-2 rounded-xl cursor-pointer transition-all ${
                      selectedTable === table.name
                        ? 'border-teal-500 bg-slate-800/50 shadow-lg shadow-teal-500/20'
                        : 'border-slate-700/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{schemaInfo?.icon || '📁'}</span>
                        <h3 className="font-medium text-white">{table.name}</h3>
                      </div>
                      <span className="text-xs text-gray-500">{table.recordCount} records</span>
                    </div>
                    <p className="text-sm text-gray-400">{schemaInfo?.description}</p>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Table Details */}
        <div className="lg:col-span-2">
          {selectedTable ? (
            <>
              <h2 className="text-xl font-semibold text-white mb-4">
                {selectedTable} Schema
              </h2>
              
              {/* Columns */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-medium text-white mb-4 flex items-center">
                  <Table className="h-5 w-5 mr-2 text-teal-400" />
                  Columns
                </h3>
                <div className="space-y-2">
                  {tables.find(t => t.name === selectedTable)?.columns.map((col) => (
                    <div key={col.name} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {col.isPrimary && <Key className="h-4 w-4 text-amber-400" />}
                        <span className="font-mono text-sm text-white">{col.name}</span>
                        {col.isOptional && <span className="text-xs text-gray-500">optional</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(col.type)}
                        <span className="text-sm text-gray-400">{col.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample Data */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-white">Sample Data</h3>
                  {tableData.length > 0 && (
                    <button
                      onClick={() => {
                        if (selectedTable === 'BankTransaction') {
                          router.push('/bookkeeping/transactions')
                        } else {
                          // Load next batch of records
                          const nextBatch = 50
                          fetchTableData(selectedTable, nextBatch, true)
                          toast.success(`Loading more records...`)
                        }
                      }}
                      disabled={loadingData || !hasMore}
                      className="px-3 py-1 bg-teal-600/20 text-teal-400 rounded-lg hover:bg-teal-600/30 transition-colors text-sm border border-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {selectedTable === 'BankTransaction' ? 'View in Transactions' : 
                       loadingData ? 'Loading...' : 
                       hasMore ? 'Load More' : 'All Records Loaded'}
                    </button>
                  )}
                </div>
                {loadingData ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin h-8 w-8 border-2 border-teal-500 border-t-transparent rounded-full"></div>
                  </div>
                ) : tableData.length > 0 ? (
                  <div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-700">
                            {Object.keys(tableData[0]).slice(0, 6).map((key) => (
                              <th key={key} className="text-left py-2 px-3 text-gray-400 font-medium whitespace-nowrap">
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tableData.map((row, idx) => (
                            <tr key={idx} className="border-b border-slate-700/30 hover:bg-slate-800/50">
                              {Object.entries(row).slice(0, 6).map(([key, value]) => (
                                <td key={key} className="py-2 px-3 text-gray-300 max-w-xs">
                                  <div className="truncate" title={String(value)}>
                                    {value instanceof Date ? new Date(value).toLocaleDateString() : 
                                     typeof value === 'boolean' ? (value ? '✓' : '✗') :
                                     String(value) || '-'}
                                  </div>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500">
                        Showing {tableData.length} of {totalRecords} records
                      </p>
                      {hasMore && (
                        <p className="text-xs text-amber-400">
                          Click &quot;Load More&quot; to see additional records
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">No data available</p>
                )}
                
                {/* Loading indicator for appending data */}
                {loadingData && tableData.length > 0 && (
                  <div className="flex items-center justify-center py-4 text-teal-400">
                    <div className="animate-spin h-5 w-5 border-2 border-teal-500 border-t-transparent rounded-full mr-2"></div>
                    <span className="text-sm">Loading more records...</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Database className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Select a table to view its schema and data</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}