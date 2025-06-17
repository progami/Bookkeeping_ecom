'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Database, Table, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { DatabaseSchema } from '@/components/ui/database-schema'
import toast from 'react-hot-toast'
import { RequireXeroConnection } from '@/components/auth/require-xero-connection'
import { pageConfigs } from '@/lib/page-configs'

interface TableData {
  data: any[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

export default function DatabaseSchemaPage() {
  const router = useRouter()
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [tableData, setTableData] = useState<TableData | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 50

  const fetchTableData = async (tableName: string, page: number = 1) => {
    setLoading(true)
    try {
      const offset = (page - 1) * pageSize
      const response = await fetch(`/api/v1/database/table-data?table=${tableName}&limit=${pageSize}&offset=${offset}`)
      if (!response.ok) throw new Error('Failed to fetch table data')
      const data = await response.json()
      setTableData(data)
      setCurrentPage(page)
    } catch (error) {
      console.error('Error fetching table data:', error)
      toast.error('Failed to load table data')
    } finally {
      setLoading(false)
    }
  }

  const handleTableClick = (tableName: string) => {
    setSelectedTable(tableName)
    fetchTableData(tableName, 1)
  }

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (value instanceof Date || typeof value === 'string' && !isNaN(Date.parse(value))) {
      return new Date(value).toLocaleDateString('en-GB', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    if (typeof value === 'number') {
      return value.toLocaleString('en-GB', { maximumFractionDigits: 2 })
    }
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    return String(value)
  }

  const totalPages = tableData ? Math.ceil(tableData.total / pageSize) : 0

  return (
    <RequireXeroConnection pageConfig={pageConfigs.database}>
      <div className="min-h-screen bg-slate-950">
        <div className="container mx-auto px-4 py-6 sm:py-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => router.back()}
              className="text-gray-400 hover:text-white transition-colors mb-4 inline-flex items-center group"
            >
              <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back
            </button>
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold text-white mb-2 flex items-center">
                  <Database className="h-10 w-10 mr-4 text-teal-400" />
                  Database Schema
                </h1>
                <p className="text-gray-400">
                  SQLite database structure and relationships. Click on any table to view its data.
                </p>
              </div>
            </div>
          </div>

          {/* Schema Content */}
          <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
            <DatabaseSchema onTableClick={handleTableClick} />
          </div>

        {/* Table Data Modal */}
        {selectedTable && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
              <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center">
                  <Table className="h-5 w-5 mr-3 text-teal-400" />
                  {selectedTable} Data
                  <span className="ml-3 text-sm text-gray-400 font-normal">
                    ({tableData?.total || 0} total records)
                  </span>
                </h2>
                <button
                  onClick={() => {
                    setSelectedTable(null)
                    setTableData(null)
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-x-auto max-h-[calc(90vh-200px)]">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : tableData && tableData.data.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-900">
                      <tr className="border-b border-slate-700">
                        {Object.keys(tableData.data[0]).map((key) => (
                          <th key={key} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {tableData.data.map((row, index) => (
                        <tr key={index} className="hover:bg-slate-800/50 transition-colors">
                          {Object.entries(row).map(([key, value]) => (
                            <td key={key} className="px-4 py-3 text-gray-300 whitespace-nowrap">
                              {formatValue(value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-center text-gray-400 py-12">No data found in this table</p>
                )}
              </div>

              {/* Pagination */}
              {tableData && totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between">
                  <div className="text-sm text-gray-400">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, tableData.total)} of {tableData.total} records
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchTableData(selectedTable, currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 bg-slate-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-3 py-1 text-sm text-gray-400">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => fetchTableData(selectedTable, currentPage + 1)}
                      disabled={!tableData.hasMore}
                      className="px-3 py-1 bg-slate-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </RequireXeroConnection>
  )
}