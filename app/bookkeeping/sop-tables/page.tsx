'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, FileText, Calendar, Package, Hash, Plus, Edit2, Trash2, Save, X, Upload, Download, AlertCircle, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { sopData as initialSopData, rules, chartOfAccounts, departments, regions } from '@/lib/sop-data'

interface SOP {
  id?: string
  year: string
  chartOfAccount: string
  pointOfInvoice?: string
  serviceType: string
  referenceTemplate: string
  referenceExample: string
  descriptionTemplate: string
  descriptionExample: string
  note?: string
  isActive?: boolean
}

interface EditingRow {
  index: number
  sop: SOP
  isNew: boolean
}

export default function SOPTablesPage() {
  const router = useRouter()
  const [year, setYear] = useState<'2024' | '2025'>('2025')
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [sopData, setSopData] = useState<typeof initialSopData>(initialSopData)
  const [editingRow, setEditingRow] = useState<EditingRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Load SOPs from database on mount
  useEffect(() => {
    loadSOPs()
  }, [])

  const loadSOPs = async () => {
    try {
      const response = await fetch('/api/v1/bookkeeping/sops')
      if (response.ok) {
        const dbSops = await response.json()
        
        // Merge database SOPs with initial data
        const mergedData = { ...initialSopData }
        
        dbSops.forEach((sop: SOP) => {
          const year = sop.year as '2024' | '2025'
          const yearData = mergedData[year] as any
          if (!yearData[sop.chartOfAccount]) {
            yearData[sop.chartOfAccount] = []
          }
          
          // Replace or add the SOP
          const existingIndex = yearData[sop.chartOfAccount].findIndex(
            (s: any) => s.serviceType === sop.serviceType
          )
          
          if (existingIndex >= 0) {
            yearData[sop.chartOfAccount][existingIndex] = sop
          } else {
            yearData[sop.chartOfAccount].push(sop)
          }
        })
        
        setSopData(mergedData)
      }
    } catch (error) {
      console.error('Error loading SOPs:', error)
    }
  }

  const yearData = sopData[year] as any
  const accounts = Object.keys(yearData)
  const selectedData = selectedAccount ? yearData[selectedAccount] || [] : []

  const handleEdit = (sop: any, index: number) => {
    setEditingRow({
      index,
      sop: { ...sop, year, chartOfAccount: selectedAccount },
      isNew: false
    })
  }

  const handleAddNew = () => {
    if (!selectedAccount) {
      toast.error('Please select an account first')
      return
    }

    const newSop: SOP = {
      year,
      chartOfAccount: selectedAccount,
      pointOfInvoice: year === '2025' ? '' : undefined,
      serviceType: '',
      referenceTemplate: '',
      referenceExample: '',
      descriptionTemplate: '',
      descriptionExample: '',
      note: ''
    }

    setEditingRow({
      index: selectedData.length,
      sop: newSop,
      isNew: true
    })
  }

  const handleSave = async () => {
    if (!editingRow) return

    const { sop, isNew, index } = editingRow

    // Validate required fields
    if (!sop.serviceType || !sop.referenceTemplate || !sop.descriptionTemplate) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)

    try {
      if (isNew) {
        // Create new SOP
        const response = await fetch('/api/v1/bookkeeping/sops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sop)
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to create SOP')
        }

        const newSop = await response.json()
        
        // Update local state
        const updatedData = { ...sopData }
        const updatedYearData = updatedData[year] as any
        if (!updatedYearData[selectedAccount]) {
          updatedYearData[selectedAccount] = []
        }
        updatedYearData[selectedAccount].push(newSop)
        setSopData(updatedData)
        
        toast.success('SOP created successfully')
      } else {
        // Update existing SOP
        const response = await fetch(`/api/v1/bookkeeping/sops/${sop.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sop)
        })

        if (!response.ok) {
          throw new Error('Failed to update SOP')
        }

        const updatedSop = await response.json()
        
        // Update local state
        const updatedData = { ...sopData }
        const updatedYearData = updatedData[year] as any
        updatedYearData[selectedAccount][index] = updatedSop
        setSopData(updatedData)
        
        toast.success('SOP updated successfully')
      }

      setEditingRow(null)
      setHasChanges(true)
    } catch (error) {
      console.error('Error saving SOP:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save SOP')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (sop: any, index: number) => {
    if (!confirm('Are you sure you want to delete this SOP?')) return

    setLoading(true)

    try {
      if (sop.id) {
        const response = await fetch(`/api/v1/bookkeeping/sops/${sop.id}`, {
          method: 'DELETE'
        })

        if (!response.ok) {
          throw new Error('Failed to delete SOP')
        }
      }

      // Update local state
      const updatedData = { ...sopData }
      const updatedYearData = updatedData[year] as any
      updatedYearData[selectedAccount].splice(index, 1)
      setSopData(updatedData)
      
      toast.success('SOP deleted successfully')
      setHasChanges(true)
    } catch (error) {
      console.error('Error deleting SOP:', error)
      toast.error('Failed to delete SOP')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setEditingRow(null)
  }

  const handleFieldChange = (field: keyof SOP, value: string) => {
    if (!editingRow) return
    
    setEditingRow({
      ...editingRow,
      sop: {
        ...editingRow.sop,
        [field]: value
      }
    })
  }

  const exportToJSON = () => {
    const dataToExport = {
      sopData,
      rules,
      chartOfAccounts,
      exportedAt: new Date().toISOString()
    }

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sop-data-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('SOPs exported successfully')
  }

  const importFromJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string)
        
        if (imported.sopData) {
          // Save all imported SOPs to database
          const allSops: SOP[] = []
          
          Object.entries(imported.sopData).forEach(([year, yearData]: [string, any]) => {
            Object.entries(yearData).forEach(([account, sops]: [string, any]) => {
              sops.forEach((sop: any) => {
                allSops.push({
                  ...sop,
                  year,
                  chartOfAccount: account
                })
              })
            })
          })

          // Bulk update
          const response = await fetch('/api/v1/bookkeeping/sops', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sops: allSops })
          })

          if (!response.ok) {
            throw new Error('Failed to import SOPs')
          }

          setSopData(imported.sopData)
          toast.success('SOPs imported successfully')
          setHasChanges(true)
        }
      } catch (error) {
        console.error('Error importing SOPs:', error)
        toast.error('Failed to import SOPs. Please check the file format.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/bookkeeping/sop-generator')}
          className="text-gray-400 hover:text-white transition-colors mb-4 inline-flex items-center"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to SOP Generator
        </button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center">
              <FileText className="h-8 w-8 mr-3 text-indigo-400" />
              SOP Reference Tables
            </h1>
            <p className="text-gray-400">
              Manage Standard Operating Procedures for {year}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Import/Export */}
            <div className="flex gap-2">
              <button
                onClick={exportToJSON}
                className="px-4 py-2 bg-slate-700/50 text-gray-300 rounded-lg hover:bg-slate-700/70 hover:text-white transition-all flex items-center"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
              <label className="px-4 py-2 bg-slate-700/50 text-gray-300 rounded-lg hover:bg-slate-700/70 hover:text-white transition-all flex items-center cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Import
                <input
                  type="file"
                  accept=".json"
                  onChange={importFromJSON}
                  className="hidden"
                />
              </label>
            </div>
            
            {/* Year Selector */}
            <div className="flex bg-slate-800/30 rounded-lg p-1">
              <button
                onClick={() => setYear('2024')}
                className={`px-4 py-2 rounded-md transition-all ${
                  year === '2024'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                2024
              </button>
              <button
                onClick={() => setYear('2025')}
                className={`px-4 py-2 rounded-md transition-all ${
                  year === '2025'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                2025
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Account Selector */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex-1 max-w-md">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Hash className="h-4 w-4 inline mr-1" />
            Select Chart of Account
          </label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="w-full px-4 py-2 bg-slate-800/50 text-white rounded-lg border border-slate-700 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">Select an account to view/edit SOPs</option>
            {accounts.map(account => (
              <option key={account} value={account}>{account}</option>
            ))}
          </select>
        </div>
        
        {selectedAccount && (
          <button
            onClick={handleAddNew}
            disabled={editingRow !== null}
            className="ml-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New SOP
          </button>
        )}
      </div>

      {/* SOP Table */}
      {selectedAccount ? (
        selectedData.length > 0 || editingRow?.isNew ? (
          <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-900/50 border-b border-slate-700">
                  <tr>
                    {year === '2025' && (
                      <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Point of Invoice
                      </th>
                    )}
                    <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Service Type <span className="text-red-400">*</span>
                    </th>
                    <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Reference Template <span className="text-red-400">*</span>
                    </th>
                    <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Reference Example
                    </th>
                    <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Description Template <span className="text-red-400">*</span>
                    </th>
                    <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Description Example
                    </th>
                    <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Note
                    </th>
                    <th className="p-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {selectedData.map((item: any, index: number) => (
                    <tr key={index} className="hover:bg-slate-800/50 transition-colors">
                      {editingRow?.index === index && !editingRow.isNew ? (
                        // Edit mode
                        <>
                          {year === '2025' && (
                            <td className="p-4">
                              <input
                                type="text"
                                value={editingRow.sop.pointOfInvoice || ''}
                                onChange={(e) => handleFieldChange('pointOfInvoice', e.target.value)}
                                className="w-full px-2 py-1 bg-slate-700/50 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none text-sm"
                                placeholder="e.g., Any, 3PL, etc."
                              />
                            </td>
                          )}
                          <td className="p-4">
                            <input
                              type="text"
                              value={editingRow.sop.serviceType}
                              onChange={(e) => handleFieldChange('serviceType', e.target.value)}
                              className="w-full px-2 py-1 bg-slate-700/50 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none text-sm"
                              placeholder="Service type"
                              required
                            />
                          </td>
                          <td className="p-4">
                            <input
                              type="text"
                              value={editingRow.sop.referenceTemplate}
                              onChange={(e) => handleFieldChange('referenceTemplate', e.target.value)}
                              className="w-full px-2 py-1 bg-slate-700/50 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none text-sm font-mono"
                              placeholder="<Invoice#>..."
                              required
                            />
                          </td>
                          <td className="p-4">
                            <input
                              type="text"
                              value={editingRow.sop.referenceExample}
                              onChange={(e) => handleFieldChange('referenceExample', e.target.value)}
                              className="w-full px-2 py-1 bg-slate-700/50 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none text-sm font-mono"
                              placeholder="Example"
                            />
                          </td>
                          <td className="p-4">
                            <input
                              type="text"
                              value={editingRow.sop.descriptionTemplate}
                              onChange={(e) => handleFieldChange('descriptionTemplate', e.target.value)}
                              className="w-full px-2 py-1 bg-slate-700/50 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none text-sm font-mono"
                              placeholder="<Department>..."
                              required
                            />
                          </td>
                          <td className="p-4">
                            <input
                              type="text"
                              value={editingRow.sop.descriptionExample}
                              onChange={(e) => handleFieldChange('descriptionExample', e.target.value)}
                              className="w-full px-2 py-1 bg-slate-700/50 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none text-sm font-mono"
                              placeholder="Example"
                            />
                          </td>
                          <td className="p-4">
                            <input
                              type="text"
                              value={editingRow.sop.note || ''}
                              onChange={(e) => handleFieldChange('note', e.target.value)}
                              className="w-full px-2 py-1 bg-slate-700/50 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none text-sm"
                              placeholder="Optional note"
                            />
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <button
                                onClick={handleSave}
                                disabled={loading}
                                className="text-emerald-400 hover:text-emerald-300 transition-colors"
                                title="Save"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                              <button
                                onClick={handleCancel}
                                disabled={loading}
                                className="text-gray-400 hover:text-white transition-colors"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        // View mode
                        <>
                          {year === '2025' && (
                            <td className="p-4 text-sm text-gray-300">
                              {item.pointOfInvoice || '-'}
                            </td>
                          )}
                          <td className="p-4 text-sm font-medium text-white">
                            {item.serviceType}
                          </td>
                          <td className="p-4 text-sm text-gray-300 font-mono">
                            {item.referenceTemplate}
                          </td>
                          <td className="p-4 text-sm text-indigo-400 font-mono">
                            {item.referenceExample}
                          </td>
                          <td className="p-4 text-sm text-gray-300 font-mono">
                            {item.descriptionTemplate}
                          </td>
                          <td className="p-4 text-sm text-emerald-400 font-mono">
                            {item.descriptionExample}
                          </td>
                          <td className="p-4 text-sm text-gray-400">
                            {item.note || '-'}
                          </td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEdit(item, index)}
                                disabled={editingRow !== null || loading}
                                className="text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Edit"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(item, index)}
                                disabled={editingRow !== null || loading}
                                className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  
                  {/* New row */}
                  {editingRow?.isNew && (
                    <tr className="bg-emerald-900/10">
                      {year === '2025' && (
                        <td className="p-4">
                          <input
                            type="text"
                            value={editingRow.sop.pointOfInvoice || ''}
                            onChange={(e) => handleFieldChange('pointOfInvoice', e.target.value)}
                            className="w-full px-2 py-1 bg-slate-700/50 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none text-sm"
                            placeholder="e.g., Any, 3PL, etc."
                          />
                        </td>
                      )}
                      <td className="p-4">
                        <input
                          type="text"
                          value={editingRow.sop.serviceType}
                          onChange={(e) => handleFieldChange('serviceType', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-700/50 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none text-sm"
                          placeholder="Service type"
                          required
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="text"
                          value={editingRow.sop.referenceTemplate}
                          onChange={(e) => handleFieldChange('referenceTemplate', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-700/50 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none text-sm font-mono"
                          placeholder="<Invoice#>..."
                          required
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="text"
                          value={editingRow.sop.referenceExample}
                          onChange={(e) => handleFieldChange('referenceExample', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-700/50 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none text-sm font-mono"
                          placeholder="Example"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="text"
                          value={editingRow.sop.descriptionTemplate}
                          onChange={(e) => handleFieldChange('descriptionTemplate', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-700/50 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none text-sm font-mono"
                          placeholder="<Department>..."
                          required
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="text"
                          value={editingRow.sop.descriptionExample}
                          onChange={(e) => handleFieldChange('descriptionExample', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-700/50 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none text-sm font-mono"
                          placeholder="Example"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="text"
                          value={editingRow.sop.note || ''}
                          onChange={(e) => handleFieldChange('note', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-700/50 text-white rounded border border-slate-600 focus:border-indigo-500 focus:outline-none text-sm"
                          placeholder="Optional note"
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button
                            onClick={handleSave}
                            disabled={loading}
                            className="text-emerald-400 hover:text-emerald-300 transition-colors"
                            title="Save"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            onClick={handleCancel}
                            disabled={loading}
                            className="text-gray-400 hover:text-white transition-colors"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-12 text-center">
            <FileText className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">No SOPs Defined</h3>
            <p className="text-gray-500 mb-6">No Standard Operating Procedures defined for this account in {year}</p>
            <button
              onClick={handleAddNew}
              className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all inline-flex items-center"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add First SOP
            </button>
          </div>
        )
      ) : (
        /* All Accounts Summary */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map(account => {
            const data = yearData[account]
            const sopCount = data?.length || 0
            
            return (
              <div 
                key={account}
                onClick={() => setSelectedAccount(account)}
                className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:bg-slate-800/50 hover:border-indigo-500/50 transition-all cursor-pointer"
              >
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <div className="w-1 h-6 bg-indigo-500 rounded-full mr-3" />
                  {account}
                </h3>
                {sopCount > 0 ? (
                  <div className="space-y-2">
                    {data.slice(0, 3).map((item: any, idx: number) => (
                      <div key={idx} className="text-sm">
                        <span className="text-indigo-400">{item.serviceType}</span>
                      </div>
                    ))}
                    {sopCount > 3 && (
                      <div className="text-sm text-gray-500">
                        +{sopCount - 3} more...
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">
                    No SOPs defined
                  </div>
                )}
                <div className="mt-4 text-xs text-gray-500">
                  {sopCount} SOP{sopCount !== 1 ? 's' : ''} defined
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* SOP Rules */}
      <div className="mt-8 bg-slate-800/30 backdrop-blur-sm border border-amber-500/30 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <div className="w-1 h-6 bg-amber-500 rounded-full mr-3" />
          SOP Rules & Guidelines
        </h3>
        <ul className="space-y-2 text-gray-300 text-sm">
          {rules.map((rule, index) => (
            <li key={index} className="flex items-start">
              <span className="text-amber-400 mr-2 mt-0.5">•</span>
              <span>{rule}</span>
            </li>
          ))}
        </ul>
        
        {hasChanges && (
          <div className="mt-4 p-3 bg-emerald-900/20 border border-emerald-500/30 rounded-lg flex items-center">
            <Check className="h-4 w-4 text-emerald-400 mr-2" />
            <span className="text-sm text-emerald-300">Changes saved to database</span>
          </div>
        )}
      </div>
    </div>
  )
}