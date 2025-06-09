'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Edit2, Trash2, Search, Filter, Download, Upload, ChevronUp, ChevronDown, MoreVertical, CheckSquare, Square, AlertCircle } from 'lucide-react'

interface Rule {
  id: string
  name: string
  description?: string
  matchType: string
  matchField: string
  matchValue: string
  accountCode: string
  taxType: string
  priority: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function RulesPage() {
  const router = useRouter()
  const [rules, setRules] = useState<Rule[]>([])
  const [filteredRules, setFilteredRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('priority')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selectedRules, setSelectedRules] = useState<string[]>([])
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null)

  useEffect(() => {
    fetchRules()
  }, [])

  useEffect(() => {
    filterAndSortRules()
  }, [rules, searchTerm, statusFilter, sortBy, sortOrder])

  const fetchRules = async () => {
    try {
      const response = await fetch('/api/v1/bookkeeping/rules')
      if (response.ok) {
        const data = await response.json()
        setRules(data)
      }
    } catch (error) {
      console.error('Error fetching rules:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterAndSortRules = () => {
    let filtered = [...rules]

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(rule => 
        rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rule.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rule.matchValue.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(rule => 
        statusFilter === 'active' ? rule.isActive : !rule.isActive
      )
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any = a[sortBy as keyof Rule]
      let bVal: any = b[sortBy as keyof Rule]
      
      if (sortBy === 'priority') {
        aVal = Number(aVal)
        bVal = Number(bVal)
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
    })

    setFilteredRules(filtered)
  }

  const toggleRuleStatus = async (ruleId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/v1/bookkeeping/rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus })
      })

      if (response.ok) {
        fetchRules()
        // Show success toast
        const toast = document.createElement('div')
        toast.className = 'toast-success fixed bottom-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
        toast.textContent = 'Rule status updated'
        document.body.appendChild(toast)
        setTimeout(() => toast.remove(), 3000)
      }
    } catch (error) {
      console.error('Error updating rule:', error)
    }
  }

  const deleteRule = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/v1/bookkeeping/rules/${ruleId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchRules()
        setShowDeleteDialog(false)
        setRuleToDelete(null)
      }
    } catch (error) {
      console.error('Error deleting rule:', error)
    }
  }

  const selectAll = () => {
    if (selectedRules.length === filteredRules.length) {
      setSelectedRules([])
    } else {
      setSelectedRules(filteredRules.map(r => r.id))
    }
  }

  const bulkUpdateStatus = async (status: boolean) => {
    for (const ruleId of selectedRules) {
      await fetch(`/api/v1/bookkeeping/rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: status })
      })
    }
    fetchRules()
    setSelectedRules([])
    
    // Show success toast
    const toast = document.createElement('div')
    toast.className = 'toast-success fixed bottom-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
    toast.textContent = `${selectedRules.length} rules updated`
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 3000)
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
          <h1 className="text-4xl font-bold text-white">Categorization Rules</h1>
          <button
            onClick={() => router.push('/bookkeeping/rules/new')}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
            data-testid="create-rule-btn"
          >
            <Plus className="h-5 w-5" />
            Create New Rule
          </button>
        </div>
      </div>

      {/* Filters and Actions Bar */}
      <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search rules..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                data-testid="search-rules"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
              data-testid="filter-status"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
              data-testid="sort-priority"
            >
              <option value="priority">Sort by Priority</option>
              <option value="name">Sort by Name</option>
              <option value="updatedAt">Sort by Updated</option>
            </select>
          </div>

          {/* Bulk Actions */}
          <div className="flex items-center gap-2">
            {selectedRules.length > 0 && (
              <>
                <button
                  onClick={() => bulkUpdateStatus(true)}
                  className="px-3 py-1 bg-emerald-600/20 text-emerald-400 rounded-lg hover:bg-emerald-600/30 transition-colors text-sm"
                  data-testid="bulk-activate"
                >
                  Activate ({selectedRules.length})
                </button>
                <button
                  onClick={() => bulkUpdateStatus(false)}
                  className="px-3 py-1 bg-amber-600/20 text-amber-400 rounded-lg hover:bg-amber-600/30 transition-colors text-sm"
                  data-testid="bulk-deactivate"
                >
                  Deactivate ({selectedRules.length})
                </button>
              </>
            )}
            <button
              className="px-3 py-1 bg-slate-700/50 text-gray-300 rounded-lg hover:bg-slate-700/70 transition-colors text-sm"
              data-testid="export-csv"
            >
              <Download className="h-4 w-4 inline mr-1" />
              Export
            </button>
            <button
              className="px-3 py-1 bg-slate-700/50 text-gray-300 rounded-lg hover:bg-slate-700/70 transition-colors text-sm"
              data-testid="import-csv"
            >
              <Upload className="h-4 w-4 inline mr-1" />
              Import
            </button>
          </div>
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-emerald-500/20 rounded-full animate-pulse" />
              <div className="absolute inset-0 w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="p-12 text-center" data-testid="empty-state">
            <AlertCircle className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">
              {searchTerm || statusFilter !== 'all' 
                ? 'No rules match your filters' 
                : 'No categorization rules configured yet'}
            </p>
            <button
              onClick={() => router.push('/bookkeeping/rules/new')}
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Create your first rule
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-900/50 border-b border-slate-700/50">
              <tr>
                <th className="p-4 text-left">
                  <button
                    onClick={selectAll}
                    className="text-gray-400 hover:text-white transition-colors"
                    data-testid="select-all"
                  >
                    {selectedRules.length === filteredRules.length ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="p-4 text-left text-gray-400 font-medium text-sm uppercase tracking-wider">Name</th>
                <th className="p-4 text-left text-gray-400 font-medium text-sm uppercase tracking-wider">Match Type</th>
                <th className="p-4 text-left text-gray-400 font-medium text-sm uppercase tracking-wider">Match Field</th>
                <th className="p-4 text-left text-gray-400 font-medium text-sm uppercase tracking-wider">Priority</th>
                <th className="p-4 text-left text-gray-400 font-medium text-sm uppercase tracking-wider">Status</th>
                <th className="p-4 text-left text-gray-400 font-medium text-sm uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map((rule) => (
                <tr key={rule.id} className="border-b border-slate-700/50 hover:bg-slate-900/50 transition-colors">
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selectedRules.includes(rule.id)}
                      onChange={() => {
                        if (selectedRules.includes(rule.id)) {
                          setSelectedRules(selectedRules.filter(id => id !== rule.id))
                        } else {
                          setSelectedRules([...selectedRules, rule.id])
                        }
                      }}
                      className="rounded border-gray-600 text-emerald-500 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="p-4">
                    <div>
                      <p className="text-white font-medium">{rule.name}</p>
                      {rule.description && (
                        <p className="text-gray-400 text-sm mt-1">{rule.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-slate-700/50 text-gray-300 rounded text-sm">
                      {rule.matchType}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="text-sm">
                      <p className="text-gray-300">{rule.matchField}</p>
                      <p className="text-gray-500">&quot;{rule.matchValue}&quot;</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{rule.priority}</span>
                      <button
                        onClick={() => {
                          const newOrder = sortOrder === 'asc' ? 'desc' : 'asc'
                          setSortOrder(newOrder)
                          setSortBy('priority')
                        }}
                        className="text-gray-500 hover:text-white transition-colors"
                      >
                        {sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    </div>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => toggleRuleStatus(rule.id, rule.isActive)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        rule.isActive ? 'bg-emerald-600' : 'bg-gray-600'
                      }`}
                      data-testid="toggle-status"
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          rule.isActive ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/bookkeeping/rules/${rule.id}/edit`)}
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                        data-testid="edit-rule"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setRuleToDelete(rule.id)
                          setShowDeleteDialog(true)
                        }}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                        data-testid="delete-rule"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full mx-4" data-testid="confirm-dialog">
            <h3 className="text-xl font-semibold text-white mb-2">Delete Rule</h3>
            <p className="text-gray-400 mb-6">
              Are you sure you want to delete this rule? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteDialog(false)
                  setRuleToDelete(null)
                }}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => ruleToDelete && deleteRule(ruleToDelete)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Dialog (placeholder) */}
      <div className="hidden" data-testid="import-dialog"></div>

      {/* Test Dialog (placeholder) */}
      <div className="hidden" data-testid="test-dialog"></div>
    </div>
  )
}