'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Trash2, AlertCircle, TestTube, History, ChevronRight } from 'lucide-react'

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

export default function EditRulePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [testResult, setTestResult] = useState<{match: boolean; account?: string} | null>(null)
  const [originalData, setOriginalData] = useState<Rule | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    matchField: 'description',
    matchType: 'contains',
    matchValue: '',
    accountCode: '',
    taxType: 'INPUT2',
    priority: 10,
    isActive: true
  })

  useEffect(() => {
    fetchRule()
  }, [params.id])

  const fetchRule = async () => {
    try {
      const response = await fetch(`/api/v1/bookkeeping/rules/${params.id}`)
      if (response.ok) {
        const rule = await response.json()
        setOriginalData(rule)
        setFormData({
          name: rule.name,
          description: rule.description || '',
          matchField: rule.matchField,
          matchType: rule.matchType,
          matchValue: rule.matchValue,
          accountCode: rule.accountCode,
          taxType: rule.taxType,
          priority: rule.priority,
          isActive: rule.isActive
        })
      } else {
        setErrors({ fetch: 'Failed to load rule' })
      }
    } catch (error) {
      setErrors({ fetch: 'Error loading rule' })
    } finally {
      setLoading(false)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Rule name is required'
    }
    if (!formData.matchValue.trim()) {
      newErrors.matchValue = 'Match value is required'
    }
    if (!formData.accountCode.trim()) {
      newErrors.accountCode = 'Account code is required'
    }
    if (formData.priority < 0) {
      newErrors.priority = 'Priority must be 0 or greater'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      const errorDiv = document.createElement('div')
      errorDiv.className = 'error-message fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
      errorDiv.textContent = 'Please fix the errors before submitting'
      document.body.appendChild(errorDiv)
      setTimeout(() => errorDiv.remove(), 3000)
      return
    }

    setSaving(true)

    try {
      const response = await fetch(`/api/v1/bookkeeping/rules/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        const toast = document.createElement('div')
        toast.className = 'toast-success fixed bottom-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
        toast.textContent = 'Rule updated successfully'
        document.body.appendChild(toast)
        setTimeout(() => toast.remove(), 3000)
        
        router.push('/bookkeeping/rules')
      } else {
        const data = await response.json()
        setErrors({ submit: data.error || 'Failed to update rule' })
      }
    } catch (error) {
      setErrors({ submit: 'An error occurred while updating the rule' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/v1/bookkeeping/rules/${params.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        const toast = document.createElement('div')
        toast.className = 'toast-success fixed bottom-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
        toast.textContent = 'Rule deleted successfully'
        document.body.appendChild(toast)
        setTimeout(() => toast.remove(), 3000)
        
        router.push('/bookkeeping/rules')
      }
    } catch (error) {
      console.error('Error deleting rule:', error)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : 
              name === 'priority' ? parseInt(value) || 0 : value
    }))
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const testRule = () => {
    const testTransaction = {
      description: 'Office supplies from Staples',
      payee: 'Staples Inc',
      reference: 'INV-2024-001'
    }

    const fieldValue = testTransaction[formData.matchField as keyof typeof testTransaction] || ''
    let match = false

    switch (formData.matchType) {
      case 'contains':
        match = fieldValue.toLowerCase().includes(formData.matchValue.toLowerCase())
        break
      case 'equals':
        match = fieldValue.toLowerCase() === formData.matchValue.toLowerCase()
        break
      case 'startsWith':
        match = fieldValue.toLowerCase().startsWith(formData.matchValue.toLowerCase())
        break
      case 'endsWith':
        match = fieldValue.toLowerCase().endsWith(formData.matchValue.toLowerCase())
        break
    }

    setTestResult({
      match,
      account: match ? formData.accountCode : undefined
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-emerald-500/20 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-8" data-testid="breadcrumb">
        <ol className="flex items-center space-x-2 text-sm">
          <li>
            <button onClick={() => router.push('/bookkeeping')} className="text-gray-400 hover:text-white transition-colors">
              Bookkeeping
            </button>
          </li>
          <li className="text-gray-600">
            <ChevronRight className="h-4 w-4" />
          </li>
          <li>
            <button onClick={() => router.push('/bookkeeping/rules')} className="text-gray-400 hover:text-white transition-colors">
              Rules
            </button>
          </li>
          <li className="text-gray-600">
            <ChevronRight className="h-4 w-4" />
          </li>
          <li className="text-white">Edit Rule</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-4xl font-bold text-white">Edit Rule</h1>
        <button
          onClick={() => setShowDeleteDialog(true)}
          className="px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors flex items-center gap-2"
          data-testid="delete-from-edit"
        >
          <Trash2 className="h-4 w-4" />
          Delete Rule
        </button>
      </div>

      {/* Rule History */}
      {originalData && (
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 mb-6" data-testid="rule-history">
          <div className="flex items-center gap-3 text-sm">
            <History className="h-4 w-4 text-gray-500" />
            <span className="text-gray-400">Created {new Date(originalData.createdAt).toLocaleDateString()}</span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-400" data-testid="last-modified">
              Last modified {new Date(originalData.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-8 space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <div className="w-1 h-6 bg-emerald-500 rounded-full mr-3" />
            Basic Information
          </h2>
          
          <div>
            <label htmlFor="name" className="block text-gray-300 text-sm font-medium mb-2">
              Rule Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border ${
                errors.name ? 'border-red-500' : 'border-slate-600'
              } focus:border-emerald-500 focus:outline-none`}
              placeholder="e.g., Office Supplies"
            />
            {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="description" className="block text-gray-300 text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
              rows={3}
              placeholder="Optional description of what this rule categorizes"
            />
          </div>
        </div>

        {/* Matching Criteria */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <div className="w-1 h-6 bg-cyan-500 rounded-full mr-3" />
            Matching Criteria
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="matchField" className="block text-gray-300 text-sm font-medium mb-2">
                Match Field
              </label>
              <select
                id="matchField"
                name="matchField"
                value={formData.matchField}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
              >
                <option value="description">Description</option>
                <option value="payee">Payee</option>
                <option value="reference">Reference</option>
              </select>
            </div>

            <div>
              <label htmlFor="matchType" className="block text-gray-300 text-sm font-medium mb-2">
                Match Type
              </label>
              <select
                id="matchType"
                name="matchType"
                value={formData.matchType}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
              >
                <option value="contains">Contains</option>
                <option value="equals">Equals</option>
                <option value="startsWith">Starts With</option>
                <option value="endsWith">Ends With</option>
              </select>
            </div>

            <div>
              <label htmlFor="matchValue" className="block text-gray-300 text-sm font-medium mb-2">
                Match Value <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="matchValue"
                name="matchValue"
                value={formData.matchValue}
                onChange={handleChange}
                className={`w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border ${
                  errors.matchValue ? 'border-red-500' : 'border-slate-600'
                } focus:border-emerald-500 focus:outline-none`}
                placeholder="e.g., office supplies"
              />
              {errors.matchValue && <p className="text-red-400 text-sm mt-1">{errors.matchValue}</p>}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowTestDialog(true)}
            className="px-4 py-2 bg-cyan-600/20 text-cyan-400 rounded-lg hover:bg-cyan-600/30 transition-colors flex items-center gap-2"
            data-testid="test-rule"
          >
            <TestTube className="h-4 w-4" />
            Test Rule
          </button>
        </div>

        {/* Categorization Target */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <div className="w-1 h-6 bg-purple-500 rounded-full mr-3" />
            Categorization Target
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="accountCode" className="block text-gray-300 text-sm font-medium mb-2">
                Account Code <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                id="accountCode"
                name="accountCode"
                value={formData.accountCode}
                onChange={handleChange}
                className={`w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border ${
                  errors.accountCode ? 'border-red-500' : 'border-slate-600'
                } focus:border-emerald-500 focus:outline-none`}
                placeholder="e.g., 400"
              />
              {errors.accountCode && <p className="text-red-400 text-sm mt-1">{errors.accountCode}</p>}
            </div>

            <div>
              <label htmlFor="taxType" className="block text-gray-300 text-sm font-medium mb-2">
                Tax Type
              </label>
              <select
                id="taxType"
                name="taxType"
                value={formData.taxType}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
              >
                <option value="INPUT2">INPUT2 (GST on Expenses)</option>
                <option value="OUTPUT2">OUTPUT2 (GST on Income)</option>
                <option value="EXEMPTINPUT">EXEMPTINPUT (No GST)</option>
                <option value="NONE">NONE</option>
              </select>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center">
            <div className="w-1 h-6 bg-amber-500 rounded-full mr-3" />
            Settings
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="priority" className="block text-gray-300 text-sm font-medium mb-2">
                Priority
              </label>
              <input
                type="number"
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className={`w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border ${
                  errors.priority ? 'border-red-500' : 'border-slate-600'
                } focus:border-emerald-500 focus:outline-none`}
                placeholder="10"
                min="0"
              />
              <p className="text-gray-500 text-xs mt-1">Higher priority rules are applied first</p>
              {errors.priority && <p className="text-red-400 text-sm mt-1">{errors.priority}</p>}
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                Status
              </label>
              <div className="flex items-center mt-3">
                <input
                  type="checkbox"
                  id="isActive"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="rounded border-gray-600 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="isActive" className="ml-2 text-gray-300">
                  Active
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {errors.submit && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
            <p className="text-red-300">{errors.submit}</p>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-700/50">
          <button
            type="button"
            onClick={() => router.push('/bookkeeping/rules')}
            className="px-6 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-emerald-800 transition-colors disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>

      {/* Test Dialog */}
      {showTestDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" data-testid="test-dialog">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-white mb-4">Test Rule</h3>
            <div className="space-y-4">
              <div className="bg-slate-900/50 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-2">Sample Transaction:</p>
                <p className="text-white">Description: Office supplies from Staples</p>
                <p className="text-white">Payee: Staples Inc</p>
                <p className="text-white">Reference: INV-2024-001</p>
              </div>
              
              <button
                onClick={testRule}
                className="w-full px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
              >
                Run Test
              </button>

              {testResult && (
                <div className={`p-4 rounded-lg ${testResult.match ? 'bg-emerald-500/20 border border-emerald-500/50' : 'bg-red-500/20 border border-red-500/50'}`}>
                  <p className={`font-medium ${testResult.match ? 'text-emerald-400' : 'text-red-400'}`}>
                    {testResult.match ? 'Match Found!' : 'No Match'}
                  </p>
                  {testResult.match && (
                    <p className="text-gray-300 text-sm mt-1">
                      Would categorize to account: {testResult.account}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowTestDialog(false)
                  setTestResult(null)
                }}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-white mb-2">Delete Rule</h3>
            <p className="text-gray-400 mb-6">
              Are you sure you want to delete &quot;{formData.name}&quot;? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}