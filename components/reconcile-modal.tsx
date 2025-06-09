'use client'

import { useState } from 'react'
import { X, AlertCircle, CheckCircle, Eye } from 'lucide-react'
import { Transaction, ReconcileData } from '@/lib/types/transactions'
import toast from 'react-hot-toast'

interface ReconcileModalProps {
  transaction: Transaction
  onClose: () => void
  onReconcile: (data: ReconcileData) => Promise<void>
}

export function ReconcileModal({ transaction, onClose, onReconcile }: ReconcileModalProps) {
  const [loading, setLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [formData, setFormData] = useState<ReconcileData>({
    transactionId: transaction.id,
    reference: transaction.matchedRule?.suggestedReference || '',
    description: transaction.matchedRule?.suggestedDescription || transaction.description,
    accountCode: transaction.matchedRule?.accountCode || '',
    taxType: transaction.matchedRule?.taxType || 'GST',
    createRule: false,
    rulePattern: transaction.description,
    ruleName: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.reference.trim()) {
      toast.error('Reference is required')
      return
    }
    
    if (!formData.description.trim()) {
      toast.error('Description is required')
      return
    }
    
    if (!formData.accountCode) {
      toast.error('Account code is required')
      return
    }
    
    if (formData.createRule && !formData.ruleName?.trim()) {
      toast.error('Rule name is required when creating a rule')
      return
    }
    
    setLoading(true)
    try {
      await onReconcile(formData)
      toast.success('Transaction reconciled successfully')
      onClose()
    } catch (error) {
      console.error('Reconciliation error:', error)
      toast.error('Failed to reconcile transaction')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">
              {transaction.matchedRule ? 'Reconcile Transaction' : 'Manual Reconciliation'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Transaction Details */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Transaction Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Date:</span>
                <span className="ml-2 text-white">
                  {new Date(transaction.date).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Amount:</span>
                <span className={`ml-2 font-medium ${
                  transaction.type === 'SPEND' ? 'text-red-400' : 'text-green-400'
                }`}>
                  {transaction.type === 'SPEND' ? '-' : '+'}${Math.abs(transaction.amount).toFixed(2)}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Original Description:</span>
                <span className="ml-2 text-white">{transaction.description}</span>
              </div>
              {transaction.contact && (
                <div className="col-span-2">
                  <span className="text-gray-500">Contact:</span>
                  <span className="ml-2 text-white">{transaction.contact}</span>
                </div>
              )}
            </div>
          </div>

          {/* Matched Rule Info */}
          {transaction.matchedRule && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
                <h3 className="text-sm font-medium text-emerald-400">Matched Rule</h3>
              </div>
              <div className="text-sm text-gray-300">
                <p>Rule: {transaction.matchedRule.ruleName}</p>
                <p>Confidence: {transaction.matchedRule.confidence}%</p>
              </div>
            </div>
          )}

          {/* Reconciliation Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Reference *
              </label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                placeholder="Enter reference"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description *
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                placeholder="Enter description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Account Code *
                </label>
                <select
                  value={formData.accountCode}
                  onChange={(e) => setFormData({ ...formData, accountCode: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select account</option>
                  <option value="200">200 - Sales</option>
                  <option value="300">300 - Purchases</option>
                  <option value="400">400 - Expenses</option>
                  <option value="500">500 - Other Income</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tax Type *
                </label>
                <select
                  value={formData.taxType}
                  onChange={(e) => setFormData({ ...formData, taxType: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="GST">GST on Income</option>
                  <option value="GSTONEXPENSES">GST on Expenses</option>
                  <option value="EXEMPTOUTPUT">GST Exempt</option>
                  <option value="NONE">No GST</option>
                </select>
              </div>
            </div>
          </div>

          {/* Create Rule Option */}
          {!transaction.matchedRule && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={formData.createRule}
                  onChange={(e) => setFormData({ ...formData, createRule: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 bg-slate-700 border-slate-600 rounded focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-300">
                  Create rule for future transactions
                </span>
              </label>

              {formData.createRule && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Rule Name *
                    </label>
                    <input
                      type="text"
                      value={formData.ruleName}
                      onChange={(e) => setFormData({ ...formData, ruleName: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                      placeholder="Enter rule name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Match Pattern
                    </label>
                    <input
                      type="text"
                      value={formData.rulePattern}
                      onChange={(e) => setFormData({ ...formData, rulePattern: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500"
                      placeholder="Pattern to match"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors flex items-center"
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview Changes
            </button>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Reconciling...
                  </>
                ) : (
                  <>
                    {formData.createRule ? 'Reconcile & Create Rule' : 'Confirm Reconcile'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Preview Changes</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="text-gray-500 mb-2">Before</h4>
                  <p className="text-gray-300">{transaction.description}</p>
                </div>
                <div>
                  <h4 className="text-gray-500 mb-2">After</h4>
                  <p className="text-white">
                    <span className="block">Ref: {formData.reference}</span>
                    <span className="block">Desc: {formData.description}</span>
                    <span className="block">Account: {formData.accountCode}</span>
                    <span className="block">Tax: {formData.taxType}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}