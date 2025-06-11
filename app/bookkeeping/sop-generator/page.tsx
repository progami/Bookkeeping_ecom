'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Zap, Copy, CheckCircle, Calendar, Building, FileText, Package, User, Info, Hash, Plus, Trash2, CopyPlus, DollarSign, Calculator } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { sopData, chartOfAccounts, serviceTypes, departments, regions, rules } from '@/lib/sop-data'

interface LineItem {
  id: string
  chartOfAccount: string
  serviceType: string
  department?: string
  region?: string
  sku?: string
  batchNumber?: string
  description?: string
  quantity: number
  unitPrice: number
  amount: number
  generatedReference?: string
  generatedDescription?: string
}

interface SOPResult {
  reference: string
  description: string
  chartOfAccount: string
  note?: string
}

// Common country codes
const countryCodes = [
  'UK', 'US', 'DE', 'FR', 'ES', 'IT', 'CN', 'IN', 'JP', 'AU', 'CA', 'NL', 'BE', 'SE', 'NO', 'DK', 'PL', 'CZ', 'HU', 'RO'
]

// Months for period selection
const months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

// Years for period selection (current year and next 2 years)
const currentYear = new Date().getFullYear()
const years = [
  (currentYear - 1).toString().slice(-2),
  currentYear.toString().slice(-2),
  (currentYear + 1).toString().slice(-2)
]

// Common locations for FBA shipments
const fbaLocations = [
  'VGlobal', 'Amazon', 'FBA UK', 'FBA US', 'FBA DE', 'FBA FR', 'FBA ES', 'FBA IT'
]

// Frequency options
const frequencyOptions = {
  'Monthly': { periods: 1, label: 'Monthly' },
  'Quarterly': { periods: 2, label: 'Quarterly' },
  'Yearly': { periods: 1, label: 'Yearly' }
}

export default function SOPGeneratorPage() {
  const router = useRouter()
  const [year, setYear] = useState<'2024' | '2025'>('2025')
  const [toasterId] = useState(() => Math.random().toString(36).substring(7))
  
  // Bill header fields
  const [vendor, setVendor] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
  const [frequency, setFrequency] = useState('Monthly')
  const [periodMonth, setPeriodMonth] = useState(months[new Date().getMonth()])
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear().toString().slice(-2))
  const [periodEndMonth, setPeriodEndMonth] = useState(months[new Date().getMonth()])
  const [periodEndYear, setPeriodEndYear] = useState(new Date().getFullYear().toString().slice(-2))
  
  // Fields that might be common or line-specific
  const [vesselName, setVesselName] = useState('')
  const [containerNumber, setContainerNumber] = useState('')
  const [countryCode, setCountryCode] = useState('UK')
  const [fbaShipmentId, setFbaShipmentId] = useState('')
  const [location, setLocation] = useState('')
  const [shortTag, setShortTag] = useState('')
  
  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: '1',
      chartOfAccount: '',
      serviceType: '',
      department: '',
      region: 'UK',
      sku: '',
      batchNumber: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      amount: 0
    }
  ])
  
  const [results, setResults] = useState<Record<string, SOPResult>>({})
  const [loading, setLoading] = useState(false)
  const [mainReference, setMainReference] = useState('')
  const [showBillView, setShowBillView] = useState(true)

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)
  const vatRate = 0.20 // 20% VAT
  const vatAmount = subtotal * vatRate
  const total = subtotal + vatAmount

  // Add new line item
  const addLineItem = () => {
    const newItem: LineItem = {
      id: Date.now().toString(),
      chartOfAccount: '',
      serviceType: '',
      department: '',
      region: 'UK',
      sku: '',
      batchNumber: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      amount: 0
    }
    setLineItems([...lineItems, newItem])
  }

  // Remove line item
  const removeLineItem = (id: string) => {
    if (lineItems.length === 1) {
      toast.error('At least one line item is required')
      return
    }
    setLineItems(lineItems.filter(item => item.id !== id))
    const newResults = { ...results }
    delete newResults[id]
    setResults(newResults)
  }

  // Update line item
  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(prevItems => prevItems.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value }
        
        // Auto-calculate amount when quantity or unit price changes
        if (field === 'quantity' || field === 'unitPrice') {
          updatedItem.amount = updatedItem.quantity * updatedItem.unitPrice
        }
        
        return updatedItem
      }
      return item
    }))
  }

  // Get available service types for a chart of account
  const getServiceTypesForAccount = (chartOfAccount: string): string[] => {
    const yearData = sopData[year] as any
    if (!chartOfAccount || !yearData[chartOfAccount]) return []
    const types = yearData[chartOfAccount].map((item: any) => item.serviceType)
    return [...new Set(types)] as string[]
  }

  // Validate invoice number format
  const validateInvoiceNumber = (value: string) => {
    if (value.includes('_')) {
      toast.error('Invoice number cannot contain underscore (_)')
      return false
    }
    return true
  }

  // Generate SOPs for all line items
  const generateAllSOPs = () => {
    if (!invoiceNumber) {
      toast.error('Please enter invoice number')
      return
    }

    if (!validateInvoiceNumber(invoiceNumber)) {
      return
    }

    const invalidItems = lineItems.filter(item => !item.chartOfAccount || !item.serviceType)
    if (invalidItems.length > 0) {
      toast.error('Please fill in chart of account and service type for all line items')
      return
    }

    setLoading(true)
    const newResults: Record<string, SOPResult> = {}
    
    setTimeout(() => {
      lineItems.forEach((item, index) => {
        const yearData = sopData[year] as any
        const sopRules = yearData[item.chartOfAccount] || []
        const rule = sopRules.find((r: any) => r.serviceType === item.serviceType)
        
        if (!rule) {
          toast.error(`No SOP rule found for ${item.chartOfAccount} - ${item.serviceType}`)
          return
        }
        
        // Format period based on frequency
        const formattedPeriod = `${periodMonth}${periodYear}`
        const formattedPeriodEnd = frequency === 'Quarterly' ? `${periodEndMonth}${periodEndYear}` : ''
        
        // Generate reference based on template
        let reference = rule.referenceTemplate
          .replace('<Invoice#>', invoiceNumber)
          .replace('<InternalInvoice#>', invoiceNumber)
          .replace('<Frequency>', frequency)
          .replace('[Month Year]', formattedPeriod)
          .replace('<PeriodMonthYear>', formattedPeriod)
          .replace('<Vessel Name>', vesselName)
          .replace('<Container #>', containerNumber)
          .replace('<Country Code>', countryCode)
          .replace('<FBA Shipment Plan ID>', fbaShipmentId)
          .replace('<Location>', location)
          .replace('<MJ#>', invoiceNumber)
        
        // Generate description based on template
        let description = rule.descriptionTemplate
          .replace('<Department>', item.department || '')
          .replace('<Service>', item.serviceType)
          .replace('<ShortTag>', shortTag || 'Description')
          .replace('<SKU>', item.sku || '')
          .replace('<Batch #>', item.batchNumber || '')
          .replace('<Region>', item.region || '')
          .replace('<Frequency>', frequency)
          .replace('<PeriodStartMonthYear>', formattedPeriod)
          .replace('<PeriodEndMonthYear>', formattedPeriodEnd || formattedPeriod)
        
        // Handle special cases
        if (description.includes('Follow existing format')) {
          description = 'Please follow existing transaction format'
        }
        
        newResults[item.id] = {
          reference,
          description,
          chartOfAccount: item.chartOfAccount,
          note: rule.note
        }
        
        // Update the line item with generated description
        updateLineItem(item.id, 'generatedDescription', description)
        
        // Set main reference from first item
        if (index === 0) {
          setMainReference(reference)
        }
      })
      
      setResults(newResults)
      setLoading(false)
      toast.success(`Generated ${Object.keys(newResults).length} SOP entries`)
    }, 500)
  }
  
  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${type} copied to clipboard!`)
  }
  
  const copyAllToClipboard = (field: 'reference' | 'description') => {
    const values = lineItems
      .map(item => results[item.id]?.[field])
      .filter(Boolean)
    
    if (values.length === 0) {
      toast.error('No values to copy')
      return
    }
    
    const text = values.join('\n')
    navigator.clipboard.writeText(text)
    toast.success(`All ${field}s copied to clipboard!`)
  }
  
  const resetForm = () => {
    setLineItems([{
      id: '1',
      chartOfAccount: '',
      serviceType: '',
      department: '',
      region: 'UK',
      sku: '',
      batchNumber: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      amount: 0
    }])
    setVendor('')
    setInvoiceNumber('')
    setBillDate(new Date().toISOString().split('T')[0])
    setDueDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    setFrequency('Monthly')
    setPeriodMonth(months[new Date().getMonth()])
    setPeriodYear(new Date().getFullYear().toString().slice(-2))
    setPeriodEndMonth(months[new Date().getMonth()])
    setPeriodEndYear(new Date().getFullYear().toString().slice(-2))
    setVesselName('')
    setContainerNumber('')
    setCountryCode('UK')
    setFbaShipmentId('')
    setLocation('')
    setShortTag('')
    setResults({})
    setMainReference('')
  }

  // Check if any line item needs specific fields
  const needsVessel = lineItems.some(item => {
    const serviceType = item.serviceType
    return serviceType?.includes('Container') || serviceType?.includes('Freight') || serviceType?.includes('Customs')
  })
  
  const needsFBA = lineItems.some(item => {
    const serviceType = item.serviceType
    return serviceType?.includes('Outbound') || serviceType?.includes('LTL')
  })
  
  const needsPeriodRange = frequency === 'Quarterly' && lineItems.some(item => item.chartOfAccount?.includes('VAT'))
  
  const needsManufacturingLocation = year === '2024' && lineItems.some(item => item.chartOfAccount?.includes('Manufacturing'))

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Toaster position="top-right" toastOptions={{ id: toasterId }} />
      
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
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center">
              <Zap className="h-8 w-8 mr-3 text-emerald-400" />
              SOP Generator
            </h1>
            <p className="text-gray-400">
              Generate references and descriptions - Single or multiple line items in Xero Bill Style
            </p>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowBillView(!showBillView)}
              className={`px-4 py-2 rounded-xl transition-all ${
                showBillView 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-slate-700/50 text-gray-300 hover:bg-slate-700/70 hover:text-white'
              }`}
            >
              <FileText className="h-4 w-4 inline mr-2" />
              Bill View
            </button>
            <button
              onClick={() => router.push('/bookkeeping/sop-tables')}
              className="px-4 py-2 bg-slate-700/50 text-gray-300 rounded-xl hover:bg-slate-700/70 hover:text-white transition-all"
            >
              <FileText className="h-4 w-4 inline mr-2" />
              View SOP Tables
            </button>
          </div>
        </div>
      </div>
      
      {/* Year Selection */}
      <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-4 mb-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-300 flex items-center">
            <Calendar className="h-4 w-4 mr-2" />
            SOP Year:
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setYear('2024')}
              className={`px-4 py-2 rounded-lg transition-all ${
                year === '2024'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700/50 text-gray-300 hover:bg-slate-700/70'
              }`}
            >
              2024
            </button>
            <button
              onClick={() => setYear('2025')}
              className={`px-4 py-2 rounded-lg transition-all ${
                year === '2025'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700/50 text-gray-300 hover:bg-slate-700/70'
              }`}
            >
              2025
            </button>
          </div>
        </div>
      </div>
      
      {/* Bill/Invoice Style View */}
      <div className={`bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 mb-6 ${!showBillView && 'hidden'}`}>
        {/* Bill Header */}
        <div className="border-b border-slate-700 pb-6 mb-6">
          <h2 className="text-2xl font-bold text-white mb-6">New Bill</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Vendor / From
              </label>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="Enter vendor name"
                className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none placeholder-gray-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Invoice Number <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => {
                  const value = e.target.value
                  if (!value.includes('_')) {
                    setInvoiceNumber(value)
                  } else {
                    toast.error('Invoice number cannot contain underscore (_)')
                  }
                }}
                placeholder="Enter invoice number"
                className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none placeholder-gray-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Reference (Auto-generated)
              </label>
              <input
                type="text"
                value={mainReference}
                readOnly
                placeholder="Will be generated..."
                className="w-full px-4 py-2 bg-slate-900/50 text-emerald-400 rounded-lg border border-slate-600 placeholder-gray-600"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Bill Date
              </label>
              <input
                type="date"
                value={billDate}
                onChange={(e) => setBillDate(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
            
            <div>
              <label htmlFor="frequency-select" className="block text-sm font-medium text-gray-300 mb-2">
                Frequency / Period Type
              </label>
              <select
                id="frequency-select"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
              >
                {Object.entries(frequencyOptions).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Period {needsPeriodRange && '(Start)'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(e.target.value)}
                  className="px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                >
                  {months.map(month => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
                <select
                  value={periodYear}
                  onChange={(e) => setPeriodYear(e.target.value)}
                  className="px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                >
                  {years.map(yr => (
                    <option key={yr} value={yr}>20{yr}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {needsPeriodRange && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Period End
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={periodEndMonth}
                    onChange={(e) => setPeriodEndMonth(e.target.value)}
                    className="px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                  >
                    {months.map(month => (
                      <option key={month} value={month}>{month}</option>
                    ))}
                  </select>
                  <select
                    value={periodEndYear}
                    onChange={(e) => setPeriodEndYear(e.target.value)}
                    className="px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                  >
                    {years.map(yr => (
                      <option key={yr} value={yr}>20{yr}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Additional Fields (conditional) */}
        {(needsVessel || needsFBA || needsManufacturingLocation) && (
          <div className="border-b border-slate-700 pb-6 mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Additional Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {needsVessel && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Vessel Name
                    </label>
                    <input
                      type="text"
                      value={vesselName}
                      onChange={(e) => setVesselName(e.target.value)}
                      placeholder="e.g., OOCL Spain"
                      className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Container Number
                    </label>
                    <input
                      type="text"
                      value={containerNumber}
                      onChange={(e) => setContainerNumber(e.target.value.toUpperCase())}
                      placeholder="e.g., OOCU8157379"
                      className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Country Code
                    </label>
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                    >
                      {countryCodes.map(code => (
                        <option key={code} value={code}>{code}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              
              {needsFBA && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      FBA Shipment Plan ID
                    </label>
                    <input
                      type="text"
                      value={fbaShipmentId}
                      onChange={(e) => setFbaShipmentId(e.target.value.toUpperCase())}
                      placeholder="e.g., FBA15JNS7SYV"
                      className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Location
                    </label>
                    <select
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="">Select Location</option>
                      {fbaLocations.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              
              {needsManufacturingLocation && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Location / Manufacturer
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g., Jiangsu Guangyun Electromechanical Co., Ltd."
                    className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none placeholder-gray-500"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Short Tag / Additional Info
                </label>
                <input
                  type="text"
                  value={shortTag}
                  onChange={(e) => setShortTag(e.target.value)}
                  placeholder="Any additional description"
                  className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none placeholder-gray-500"
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Line Items Table */}
        <div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-700">
                <tr>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-8"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Account</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Service Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider w-20">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider w-28">Unit Price</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {lineItems.map((item, index) => {
                  const availableServiceTypes = getServiceTypesForAccount(item.chartOfAccount)
                  const needsDepartment = item.chartOfAccount?.includes('Contract Salaries') || 
                                        item.chartOfAccount?.includes('General Operating') || 
                                        item.chartOfAccount?.includes('IT Software') || 
                                        item.chartOfAccount?.includes('Telephone')
                  const needsRegion = item.chartOfAccount?.includes('Accounting') || 
                                     item.chartOfAccount?.includes('Legal') || 
                                     item.chartOfAccount?.includes('VAT') || 
                                     item.chartOfAccount?.includes('Interest')
                  const needsSKU = item.chartOfAccount?.includes('3PL') || 
                                  item.chartOfAccount?.includes('Manufacturing') || 
                                  item.chartOfAccount?.includes('Freight') || 
                                  item.chartOfAccount?.includes('Land Freight')
                  
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30">
                      <td className="px-2 py-4">
                        {lineItems.length > 1 && (
                          <button
                            onClick={() => removeLineItem(item.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                            title="Remove line item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={item.chartOfAccount}
                          onChange={(e) => {
                            updateLineItem(item.id, 'chartOfAccount', e.target.value)
                            updateLineItem(item.id, 'serviceType', '') // Reset service type
                          }}
                          className="w-full px-3 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none text-sm"
                        >
                          <option value="">Select Account</option>
                          {Object.keys(sopData[year] as any).map(account => (
                            <option key={account} value={account}>{account}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        {item.chartOfAccount && (
                          <select
                            value={item.serviceType}
                            onChange={(e) => updateLineItem(item.id, 'serviceType', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none text-sm"
                          >
                            <option value="">Select Service Type</option>
                            {availableServiceTypes.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={item.description || ''}
                            onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                            placeholder="Custom description (optional)"
                            className="w-full px-3 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none text-sm placeholder-gray-500"
                          />
                          {item.generatedDescription && (
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-emerald-400 italic">Generated: {item.generatedDescription}</p>
                              <button
                                onClick={() => copyToClipboard(item.generatedDescription || '', 'Description')}
                                className="text-emerald-400 hover:text-emerald-300 transition-colors"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                          
                          {/* Additional fields based on account type */}
                          <div className="grid grid-cols-2 gap-2">
                            {needsDepartment && (
                              <select
                                value={item.department || ''}
                                onChange={(e) => updateLineItem(item.id, 'department', e.target.value)}
                                className="px-2 py-1 bg-slate-700/50 text-white rounded border border-slate-600 focus:border-emerald-500 focus:outline-none text-xs"
                              >
                                <option value="">Department</option>
                                {departments.map(dept => (
                                  <option key={dept} value={dept}>{dept}</option>
                                ))}
                              </select>
                            )}
                            
                            {needsRegion && (
                              <select
                                value={item.region || 'UK'}
                                onChange={(e) => updateLineItem(item.id, 'region', e.target.value)}
                                className="px-2 py-1 bg-slate-700/50 text-white rounded border border-slate-600 focus:border-emerald-500 focus:outline-none text-xs"
                              >
                                {regions.map(reg => (
                                  <option key={reg} value={reg}>{reg}</option>
                                ))}
                              </select>
                            )}
                            
                            {needsSKU && (
                              <>
                                <input
                                  type="text"
                                  value={item.sku || ''}
                                  onChange={(e) => updateLineItem(item.id, 'sku', e.target.value.toUpperCase())}
                                  placeholder="SKU"
                                  className="px-2 py-1 bg-slate-700/50 text-white rounded border border-slate-600 focus:border-emerald-500 focus:outline-none placeholder-gray-500 text-xs"
                                />
                                <input
                                  type="text"
                                  value={item.batchNumber || ''}
                                  onChange={(e) => updateLineItem(item.id, 'batchNumber', e.target.value)}
                                  placeholder="Batch #"
                                  className="px-2 py-1 bg-slate-700/50 text-white rounded border border-slate-600 focus:border-emerald-500 focus:outline-none placeholder-gray-500 text-xs"
                                />
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none text-sm text-center"
                          step="1"
                          min="0"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none text-sm text-right"
                          step="0.01"
                          min="0"
                        />
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className="text-white font-medium">£{item.amount.toFixed(2)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          
          {/* Add Line Item Button */}
          <button
            onClick={addLineItem}
            className="mt-4 px-4 py-2 bg-slate-700/50 text-gray-300 rounded-lg hover:bg-slate-700/70 hover:text-white transition-all flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Line Item
          </button>
        </div>
        
        {/* Totals */}
        <div className="mt-6 pt-6 border-t border-slate-700">
          <div className="max-w-xs ml-auto space-y-2">
            <div className="flex justify-between text-gray-300">
              <span>Subtotal:</span>
              <span>£{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>VAT (20%):</span>
              <span>£{vatAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-white font-semibold text-lg pt-2 border-t border-slate-700">
              <span>Total:</span>
              <span>£{total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex gap-4 justify-center mb-8">
        <button
          onClick={generateAllSOPs}
          disabled={loading}
          className="px-8 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center"
        >
          {loading ? (
            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <>
              <Zap className="h-5 w-5 mr-2" />
              Generate SOPs
            </>
          )}
        </button>
        <button
          onClick={resetForm}
          className="px-8 py-3 bg-slate-700/50 text-gray-300 rounded-lg hover:bg-slate-700/70 hover:text-white transition-all"
        >
          Reset Form
        </button>
      </div>
      
      {/* Summary Results */}
      {Object.keys(results).length > 0 && (
        <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 backdrop-blur-sm border border-emerald-500/30 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white flex items-center">
              <CheckCircle className="h-6 w-6 mr-2 text-emerald-400" />
              Generated SOPs Summary
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => copyToClipboard(mainReference, 'Main Reference')}
                className="px-4 py-2 bg-slate-700/50 text-gray-300 rounded-lg hover:bg-slate-700/70 hover:text-white transition-all flex items-center text-sm"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Main Reference
              </button>
              <button
                onClick={() => copyAllToClipboard('description')}
                className="px-4 py-2 bg-slate-700/50 text-gray-300 rounded-lg hover:bg-slate-700/70 hover:text-white transition-all flex items-center text-sm"
              >
                <CopyPlus className="h-4 w-4 mr-2" />
                Copy All Descriptions
              </button>
            </div>
          </div>
          
          <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-400 mb-1">Main Reference (for Xero):</p>
            <p className="text-lg font-mono text-emerald-400">{mainReference}</p>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Line Item Descriptions:</p>
            {lineItems.map((item, index) => {
              const result = results[item.id]
              if (!result) return null
              
              return (
                <div key={item.id} className="flex items-start gap-2 text-sm">
                  <span className="text-gray-500 font-mono">{index + 1}.</span>
                  <span className="text-white flex-1">{result.description}</span>
                  <button
                    onClick={() => copyToClipboard(result.description, 'Description')}
                    className="text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
      
      {/* Instructions */}
      <div className="mt-8 bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Info className="h-5 w-5 mr-2 text-cyan-400" />
          How to use in Xero
        </h3>
        <ol className="space-y-2 text-gray-300 text-sm">
          <li>1. Generate SOPs using this form - it mimics Xero's bill layout</li>
          <li>2. Open the new bill/invoice in Xero</li>
          <li>3. Copy the main reference to Xero's reference field</li>
          <li>4. For each line in Xero, copy the corresponding generated description</li>
          <li>5. The amounts and account codes should match what you've entered here</li>
          <li>6. Save the transaction in Xero</li>
        </ol>
      </div>
    </div>
  )
}