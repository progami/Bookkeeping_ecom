'use client'

import { useState } from 'react'
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface ImportDialogProps {
  onClose: () => void
  onImportComplete: () => void
}

export function ImportDialog({ onClose, onImportComplete }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<any[]>([])
  const [showPreview, setShowPreview] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.match(/\.(xlsx|xls|csv)$/)) {
      toast.error('Please upload an Excel or CSV file')
      return
    }

    setFile(selectedFile)
    
    // For demo purposes, show sample preview
    setPreview([
      { pattern: 'STRIPE', reference: 'PAYMENT-{MONTH}{YEAR}', description: 'Stripe Payment', category: '200' },
      { pattern: 'AMAZON', reference: 'AWS-{MONTH}{YEAR}', description: 'AWS Services', category: '400' },
      { pattern: 'GOOGLE', reference: 'GADS-{MONTH}{YEAR}', description: 'Google Ads', category: '300' },
    ])
    setShowPreview(true)
  }

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file')
      return
    }

    setLoading(true)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('/api/v1/bookkeeping/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to import file')
      }

      const result = await response.json()
      toast.success(`Successfully imported ${result.count} rules`)
      onImportComplete()
      onClose()
    } catch (error) {
      console.error('Import error:', error)
      toast.error('Failed to import file')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Import Bookkeeping Rules</h2>
              <p className="text-gray-400 mt-1">Upload Excel file with bookkeeping SOPs</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* File Upload */}
          <div>
            <label className="block">
              <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-emerald-500 transition-colors cursor-pointer">
                <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-white mb-2">
                  {file ? file.name : 'Click to upload Excel file'}
                </p>
                <p className="text-gray-400 text-sm">
                  Supports .xlsx, .xls, and .csv files
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </label>
          </div>

          {/* Preview */}
          {showPreview && preview.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Preview</h3>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-3">
                  Found {preview.length} rules in the file
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left p-2 text-gray-400">Pattern</th>
                        <th className="text-left p-2 text-gray-400">Reference</th>
                        <th className="text-left p-2 text-gray-400">Description</th>
                        <th className="text-left p-2 text-gray-400">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 5).map((rule, index) => (
                        <tr key={index} className="border-b border-slate-700/50">
                          <td className="p-2 text-white">{rule.pattern}</td>
                          <td className="p-2 text-gray-300">{rule.reference}</td>
                          <td className="p-2 text-gray-300">{rule.description}</td>
                          <td className="p-2 text-gray-300">{rule.category}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.length > 5 && (
                    <p className="text-sm text-gray-400 mt-2 text-center">
                      ...and {preview.length - 5} more rules
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Import Options */}
          {showPreview && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5" />
                <div className="text-sm">
                  <p className="text-amber-400 font-medium">Import Notes</p>
                  <ul className="text-amber-300 mt-1 space-y-1">
                    <li>• Duplicate rules will be skipped</li>
                    <li>• Rules will be created with default priority</li>
                    <li>• All rules will be set as active</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-700">
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-emerald-800 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Import Rules
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}