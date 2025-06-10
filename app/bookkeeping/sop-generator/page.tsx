'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Zap, Copy, CheckCircle, Calendar, Building, DollarSign, FileText, Package, User, Info, Hash } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { sopData, chartOfAccounts, serviceTypes, departments, regions, rules } from '@/lib/sop-data'

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

// Frequency options with period requirements
const frequencyOptions = {
  'Monthly': { periods: 1, label: 'Monthly' },
  'Quarterly': { periods: 2, label: 'Quarterly' },
  'Yearly': { periods: 1, label: 'Yearly' }
}

export default function SOPGeneratorPage() {
  const router = useRouter()
  const [year, setYear] = useState<'2024' | '2025'>('2025')
  const [chartOfAccount, setChartOfAccount] = useState('')
  const [serviceType, setServiceType] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [department, setDepartment] = useState('')
  const [region, setRegion] = useState('UK')
  const [frequency, setFrequency] = useState('Monthly')
  
  // Period selection states
  const [periodMonth, setPeriodMonth] = useState(months[new Date().getMonth()])
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear().toString().slice(-2))
  const [periodEndMonth, setPeriodEndMonth] = useState(months[new Date().getMonth()])
  const [periodEndYear, setPeriodEndYear] = useState(new Date().getFullYear().toString().slice(-2))
  
  const [sku, setSku] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [vesselName, setVesselName] = useState('')
  const [containerNumber, setContainerNumber] = useState('')
  const [countryCode, setCountryCode] = useState('UK')
  const [fbaShipmentId, setFbaShipmentId] = useState('')
  const [location, setLocation] = useState('')
  const [shortTag, setShortTag] = useState('')
  const [result, setResult] = useState<SOPResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [availableServiceTypes, setAvailableServiceTypes] = useState<string[]>([])

  // Update available service types when chart of account changes
  useEffect(() => {
    if (chartOfAccount && sopData[year][chartOfAccount]) {
      // Get service types directly from the SOP data for the selected account
      const types = sopData[year][chartOfAccount].map(item => item.serviceType)
      const uniqueTypes = [...new Set(types)]
      setAvailableServiceTypes(uniqueTypes)
      if (uniqueTypes.length > 0 && !uniqueTypes.includes(serviceType)) {
        setServiceType(uniqueTypes[0])
      }
    } else {
      setAvailableServiceTypes([])
    }
  }, [chartOfAccount, year, serviceType])

  // Validate invoice number format
  const validateInvoiceNumber = (value: string) => {
    // Remove any underscore as per SOP rules
    if (value.includes('_')) {
      toast.error('Invoice number cannot contain underscore (_)')
      return false
    }
    return true
  }

  const generateSOP = () => {
    if (!chartOfAccount || !serviceType || !invoiceNumber) {
      toast.error('Please fill in all required fields')
      return
    }

    if (!validateInvoiceNumber(invoiceNumber)) {
      return
    }

    setLoading(true)
    
    setTimeout(() => {
      const sopRules = sopData[year][chartOfAccount] || []
      const rule = sopRules.find(r => r.serviceType === serviceType)
      
      if (!rule) {
        toast.error('No SOP rule found for this combination')
        setLoading(false)
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
        .replace('<MJ#>', invoiceNumber) // For prepayments
      
      // Generate description based on template
      let description = rule.descriptionTemplate
        .replace('<Department>', department)
        .replace('<Service>', serviceType)
        .replace('<ShortTag>', shortTag || 'Description')
        .replace('<SKU>', sku)
        .replace('<Batch #>', batchNumber)
        .replace('<Region>', region)
        .replace('<Frequency>', frequency)
        .replace('<PeriodStartMonthYear>', formattedPeriod)
        .replace('<PeriodEndMonthYear>', formattedPeriodEnd || formattedPeriod)
      
      // Handle special cases
      if (description.includes('Follow existing format')) {
        description = 'Please follow existing transaction format'
      }
      
      setResult({
        reference,
        description,
        chartOfAccount,
        note: rule.note
      })
      
      setLoading(false)
    }, 500)
  }
  
  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${type} copied to clipboard!`)
  }
  
  const resetForm = () => {
    setChartOfAccount('')
    setServiceType('')
    setInvoiceNumber('')
    setDepartment('')
    setRegion('UK')
    setFrequency('Monthly')
    setPeriodMonth(months[new Date().getMonth()])
    setPeriodYear(new Date().getFullYear().toString().slice(-2))
    setPeriodEndMonth(months[new Date().getMonth()])
    setPeriodEndYear(new Date().getFullYear().toString().slice(-2))
    setSku('')
    setBatchNumber('')
    setVesselName('')
    setContainerNumber('')
    setCountryCode('UK')
    setFbaShipmentId('')
    setLocation('')
    setShortTag('')
    setResult(null)
  }

  // Check which fields are needed based on selected options
  const needsSKU = chartOfAccount?.includes('3PL') || chartOfAccount?.includes('Manufacturing') || chartOfAccount?.includes('Freight') || chartOfAccount?.includes('Land Freight')
  const needsVessel = serviceType?.includes('Container') || serviceType?.includes('Freight') || serviceType?.includes('Customs')
  const needsFBA = serviceType?.includes('Outbound') || serviceType?.includes('LTL')
  const needsDepartment = chartOfAccount?.includes('Contract Salaries') || chartOfAccount?.includes('General Operating') || chartOfAccount?.includes('IT Software') || chartOfAccount?.includes('Telephone')
  const needsRegion = chartOfAccount?.includes('Accounting') || chartOfAccount?.includes('Legal') || chartOfAccount?.includes('VAT') || chartOfAccount?.includes('Interest')
  const needsFrequency = chartOfAccount?.includes('Contract Salaries') || chartOfAccount?.includes('IT Software') || serviceType?.includes('Subscription') || chartOfAccount?.includes('VAT') || chartOfAccount?.includes('Telephone')
  const needsPeriodRange = frequency === 'Quarterly' && chartOfAccount?.includes('VAT')
  const needsLocation = chartOfAccount?.includes('Manufacturing') && year === '2024'

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
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
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center">
              <Zap className="h-8 w-8 mr-3 text-emerald-400" />
              SOP Generator
            </h1>
            <p className="text-gray-400">
              Generate standard references and descriptions based on Excel SOPs
            </p>
          </div>
          
          <button
            onClick={() => router.push('/bookkeeping/sop-tables')}
            className="px-4 py-2 bg-slate-700/50 text-gray-300 rounded-xl hover:bg-slate-700/70 hover:text-white transition-all"
          >
            <FileText className="h-4 w-4 inline mr-2" />
            View SOP Tables
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Form */}
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
            <div className="w-1 h-6 bg-emerald-500 rounded-full mr-3" />
            Transaction Details
          </h2>
          
          <div className="space-y-4">
            {/* Year Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                SOP Year
              </label>
              <div className="grid grid-cols-2 gap-2">
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
            
            {/* Chart of Account */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Hash className="h-4 w-4 inline mr-1" />
                Chart of Account <span className="text-red-400">*</span>
              </label>
              <select
                value={chartOfAccount}
                onChange={(e) => setChartOfAccount(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
              >
                <option value="">Select Account</option>
                {Object.keys(sopData[year]).map(account => (
                  <option key={account} value={account}>{account}</option>
                ))}
              </select>
            </div>
            
            {/* Service Type */}
            {chartOfAccount && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Package className="h-4 w-4 inline mr-1" />
                  Service Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Select Service Type</option>
                  {availableServiceTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Invoice Number */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <FileText className="h-4 w-4 inline mr-1" />
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
                placeholder="Enter invoice number (no underscores)"
                className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none placeholder-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">Cannot contain underscore (_) as it's used as separator</p>
            </div>
            
            {/* Department (conditional) */}
            {needsDepartment && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <User className="h-4 w-4 inline mr-1" />
                  Department <span className="text-red-400">*</span>
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Region (conditional) */}
            {needsRegion && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Building className="h-4 w-4 inline mr-1" />
                  Region <span className="text-red-400">*</span>
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                >
                  {regions.map(reg => (
                    <option key={reg} value={reg}>{reg}</option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Frequency (conditional) */}
            {needsFrequency && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Frequency <span className="text-red-400">*</span>
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                >
                  {Object.entries(frequencyOptions).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Period Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Period {needsPeriodRange && '(Start)'} <span className="text-red-400">*</span>
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
            
            {/* Period End (for Quarterly VAT) */}
            {needsPeriodRange && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Period End <span className="text-red-400">*</span>
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
            
            {/* SKU (conditional) */}
            {needsSKU && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  SKU <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  placeholder="e.g., CS007"
                  className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none placeholder-gray-500"
                />
              </div>
            )}
            
            {/* Batch Number (conditional) */}
            {needsSKU && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Batch Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="e.g., Batch 12 or B12"
                  className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none placeholder-gray-500"
                />
              </div>
            )}
            
            {/* Vessel Info (conditional) */}
            {needsVessel && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Vessel Name <span className="text-red-400">*</span>
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
                    Container Number <span className="text-red-400">*</span>
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
                    Country Code <span className="text-red-400">*</span>
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
            
            {/* FBA Shipment (conditional) */}
            {needsFBA && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    FBA Shipment Plan ID <span className="text-red-400">*</span>
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
                    Location <span className="text-red-400">*</span>
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
            
            {/* Location for Manufacturing 2024 */}
            {needsLocation && (
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
            
            {/* Short Tag */}
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
              <p className="text-xs text-gray-500 mt-1">Optional: Add any specific details</p>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={generateSOP}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center"
              >
                {loading ? (
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Generate SOP
                  </>
                )}
              </button>
              <button
                onClick={resetForm}
                className="px-6 py-3 bg-slate-700/50 text-gray-300 rounded-lg hover:bg-slate-700/70 hover:text-white transition-all"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
        
        {/* Result Section */}
        <div className="space-y-6">
          {result ? (
            <>
              {/* Generated Result */}
              <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 backdrop-blur-sm border border-emerald-500/30 rounded-2xl p-6">
                <h2 className="text-xl font-semibold text-white mb-6 flex items-center">
                  <CheckCircle className="h-6 w-6 mr-2 text-emerald-400" />
                  Generated SOP
                </h2>
                
                <div className="space-y-4">
                  {/* Reference */}
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-300">Reference</label>
                      <button
                        onClick={() => copyToClipboard(result.reference, 'Reference')}
                        className="text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-white font-mono text-lg break-all">{result.reference}</p>
                  </div>
                  
                  {/* Description */}
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-300">Description</label>
                      <button
                        onClick={() => copyToClipboard(result.description, 'Description')}
                        className="text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-white break-all">{result.description}</p>
                  </div>
                  
                  {/* Chart of Account */}
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <label className="text-sm font-medium text-gray-300 block mb-2">Chart of Account</label>
                    <p className="text-white">{result.chartOfAccount}</p>
                  </div>
                  
                  {/* Note */}
                  {result.note && (
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <label className="text-sm font-medium text-gray-300 block mb-2">Note</label>
                      <p className="text-gray-400 text-sm">{result.note}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Instructions */}
              <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <Info className="h-5 w-5 mr-2 text-cyan-400" />
                  How to use in Xero
                </h3>
                <ol className="space-y-2 text-gray-300 text-sm">
                  <li>1. Copy the Reference and Description using the copy buttons</li>
                  <li>2. Open the transaction in Xero</li>
                  <li>3. Paste the Reference in the &quot;Reference&quot; field</li>
                  <li>4. Paste the Description in the &quot;Description&quot; or &quot;Particulars&quot; field</li>
                  <li>5. Select the appropriate account code: {chartOfAccount}</li>
                  <li>6. If it&apos;s an operating expense, assign the department via &quot;Tracking Codes&quot;</li>
                  <li>7. Save the transaction</li>
                </ol>
              </div>
              
              {/* SOP Rules */}
              <div className="bg-slate-800/30 backdrop-blur-sm border border-amber-500/30 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-amber-400" />
                  SOP Rules
                </h3>
                <ul className="space-y-1 text-gray-300 text-sm">
                  {rules.map((rule, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-amber-400 mr-2">•</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-12 text-center">
              <Zap className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">No SOP Generated Yet</h3>
              <p className="text-gray-500">Fill in the transaction details and click &quot;Generate SOP&quot; to create standardized references</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}