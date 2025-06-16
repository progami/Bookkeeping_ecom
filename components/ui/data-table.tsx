'use client'

/**
 * DataTable Component with Bulk Actions
 * A flexible table component with multi-select, sorting, and bulk operations
 */

import { useState, useEffect, ReactNode } from 'react'
import { Check, ChevronDown, ChevronUp, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { table as tableTypography, badge } from '@/lib/typography'

// Types
export interface Column<T> {
  key: keyof T | string
  header: string
  accessor?: (row: T) => ReactNode
  sortable?: boolean
  className?: string
}

export interface BulkAction {
  label: string
  icon?: ReactNode
  action: (selectedItems: string[]) => void | Promise<void>
  variant?: 'default' | 'danger'
  confirmMessage?: string
}

interface DataTableProps<T extends { id: string }> {
  data: T[]
  columns: Column<T>[]
  bulkActions?: BulkAction[]
  onRowClick?: (row: T) => void
  isLoading?: boolean
  emptyMessage?: string
  keyboardShortcuts?: boolean
  stickyHeader?: boolean
  className?: string
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  bulkActions = [],
  onRowClick,
  isLoading = false,
  emptyMessage = 'No data found',
  keyboardShortcuts = true,
  stickyHeader = true,
  className
}: DataTableProps<T>) {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const [showBulkMenu, setShowBulkMenu] = useState(false)

  // Keyboard shortcuts
  useEffect(() => {
    if (!keyboardShortcuts) return

    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + A to select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        if (selectedRows.size === data.length) {
          setSelectedRows(new Set())
        } else {
          setSelectedRows(new Set(data.map(row => row.id)))
        }
      }
      
      // Escape to clear selection
      if (e.key === 'Escape') {
        setSelectedRows(new Set())
        setShowBulkMenu(false)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [data, selectedRows, keyboardShortcuts])

  // Sort data
  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig) return 0

    const aValue = sortConfig.key.includes('.') 
      ? sortConfig.key.split('.').reduce((obj: any, key: string) => obj?.[key], a)
      : (a as any)[sortConfig.key]
    
    const bValue = sortConfig.key.includes('.')
      ? sortConfig.key.split('.').reduce((obj: any, key: string) => obj?.[key], b)
      : (b as any)[sortConfig.key]

    if (aValue === null || aValue === undefined) return 1
    if (bValue === null || bValue === undefined) return -1

    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  // Handlers
  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' }
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' }
      }
      return null
    })
  }

  const handleSelectAll = () => {
    if (selectedRows.size === data.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(data.map(row => row.id)))
    }
  }

  const handleSelectRow = (id: string) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedRows(newSelected)
  }

  const handleBulkAction = async (action: BulkAction) => {
    if (action.confirmMessage && !confirm(action.confirmMessage)) {
      return
    }

    const selectedIds = Array.from(selectedRows)
    await action.action(selectedIds)
    setSelectedRows(new Set())
    setShowBulkMenu(false)
  }

  const getCellValue = (row: T, column: Column<T>) => {
    if (column.accessor) {
      return column.accessor(row)
    }
    
    if (typeof column.key === 'string' && column.key.includes('.')) {
      return column.key.split('.').reduce((obj: any, key) => obj?.[key], row)
    }
    
    return (row as any)[column.key]
  }

  if (isLoading) {
    return (
      <div className={cn('animate-pulse', className)}>
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50">
          <div className="h-12 bg-slate-800/50 rounded-t-xl" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 border-t border-slate-700/50" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Bulk Actions Bar */}
      {selectedRows.size > 0 && bulkActions.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-blue-600/10 border border-blue-500/30 rounded-xl animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-white">
              {selectedRows.size} item{selectedRows.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setSelectedRows(new Set())}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Clear selection
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            {bulkActions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleBulkAction(action)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all',
                  action.variant === 'danger'
                    ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30'
                    : 'bg-slate-800/50 text-gray-300 hover:bg-slate-800/70 border border-slate-700'
                )}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={cn(
              'bg-slate-800/50 border-b border-slate-700/50',
              stickyHeader && 'sticky top-0 z-10'
            )}>
              <tr>
                {bulkActions.length > 0 && (
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === data.length && data.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 bg-slate-700 border-slate-600 rounded text-blue-600 focus:ring-2 focus:ring-blue-500/20"
                      ref={(el) => {
                        if (el) {
                          el.indeterminate = selectedRows.size > 0 && selectedRows.size < data.length
                        }
                      }}
                    />
                  </th>
                )}
                {columns.map((column, index) => (
                  <th
                    key={index}
                    className={cn(
                      'px-4 py-3 text-left',
                      tableTypography.header,
                      column.sortable && 'cursor-pointer hover:bg-slate-700/30 transition-colors',
                      column.className
                    )}
                    onClick={() => column.sortable && handleSort(column.key as string)}
                  >
                    <div className="flex items-center gap-2">
                      {column.header}
                      {column.sortable && sortConfig?.key === column.key && (
                        sortConfig.direction === 'asc' 
                          ? <ChevronUp className="h-4 w-4" />
                          : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            
            <tbody>
              {sortedData.length === 0 ? (
                <tr>
                  <td 
                    colSpan={columns.length + (bulkActions.length > 0 ? 1 : 0)}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                sortedData.map((row, rowIndex) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-t border-slate-700/50 transition-colors',
                      onRowClick && 'cursor-pointer hover:bg-slate-800/30',
                      selectedRows.has(row.id) && 'bg-blue-600/5'
                    )}
                    onClick={(e) => {
                      if (onRowClick && !(e.target as HTMLElement).closest('input')) {
                        onRowClick(row)
                      }
                    }}
                  >
                    {bulkActions.length > 0 && (
                      <td className="w-12 px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(row.id)}
                          onChange={() => handleSelectRow(row.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 bg-slate-700 border-slate-600 rounded text-blue-600 focus:ring-2 focus:ring-blue-500/20"
                        />
                      </td>
                    )}
                    {columns.map((column, colIndex) => (
                      <td
                        key={colIndex}
                        className={cn(
                          'px-4 py-4',
                          colIndex === 0 ? tableTypography.cellImportant : tableTypography.cell,
                          column.className
                        )}
                      >
                        {getCellValue(row, column)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      {keyboardShortcuts && selectedRows.size > 0 && (
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className={badge.small}>⌘A</span>
          <span>Select all</span>
          <span className={badge.small}>ESC</span>
          <span>Clear selection</span>
        </div>
      )}
    </div>
  )
}