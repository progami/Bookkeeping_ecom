'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Zap, Copy, Calendar, FileText, Info, Plus, X, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import { departments, regions, sopData } from '@/lib/sop-data'
// Simple validation types and functions
interface ValidationResult {
  isValid: boolean
  error?: string
  warning?: string
  formatted?: string
}

// Basic validation functions
const validateInvoiceNumber = (value: string): ValidationResult => {
  if (!value || value.trim().length === 0) {
    return { isValid: false, error: 'Invoice number is required' }
  }
  return { isValid: true }
}

const validateSKU = (value: string): ValidationResult => {
  if (!value || value.trim().length === 0) {
    return { isValid: false, error: 'SKU is required' }
  }
  return { isValid: true, formatted: value.toUpperCase().replace(/\s+/g, '') }
}

const validateBatchNumber = (value: string): ValidationResult => {
  if (!value || value.trim().length === 0) {
    return { isValid: true } // Batch number is optional
  }
  return { isValid: true, formatted: value.toUpperCase().replace(/\s+/g, '') }
}

const validateContainerNumber = (value: string): ValidationResult => {
  if (!value || value.trim().length === 0) {
    return { isValid: true } // Container number is optional
  }
  return { isValid: true, formatted: value.toUpperCase().replace(/\s+/g, '') }
}

const validateFBAShipmentId = (value: string): ValidationResult => {
  if (!value || value.trim().length === 0) {
    return { isValid: true } // FBA shipment ID is optional
  }
  return { isValid: true, formatted: value.toUpperCase().replace(/\s+/g, '') }
}

const validateVesselName = (value: string): ValidationResult => {
  if (!value || value.trim().length === 0) {
    return { isValid: true } // Vessel name is optional
  }
  return { isValid: true }
}

// Format functions
const formatSKU = (value: string): string => value.toUpperCase().replace(/\s+/g, '')
const formatContainerNumber = (value: string): string => value.toUpperCase().replace(/\s+/g, '')
const formatFBAShipmentId = (value: string): string => value.toUpperCase().replace(/\s+/g, '')
const formatBatchNumber = (value: string): string => value.toUpperCase().replace(/\s+/g, '')

interface SOPResult {
  id: string
  reference: string
  description: string
  sku?: string
  batchNumber?: string
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

interface SKUBatch {
  id: string
  sku: string
  batchNumber: string
}

export default function SOPGeneratorPage() {
  const router = useRouter()
  const [year, setYear] = useState<'2024' | '2025'>('2025')
  const [toasterId] = useState(() => Math.random().toString(36).substring(7))
  
  // SOPs are imported directly from lib/sop-data
  
  // Core fields
  const [chartOfAccount, setChartOfAccount] = useState('')
  const [serviceType, setServiceType] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [mjNumber, setMjNumber] = useState('')
  const [frequency, setFrequency] = useState('Monthly')
  const [periodMonth, setPeriodMonth] = useState(months[new Date().getMonth()])
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear().toString().slice(-2))
  const [periodEndMonth, setPeriodEndMonth] = useState(months[new Date().getMonth()])
  const [periodEndYear, setPeriodEndYear] = useState(new Date().getFullYear().toString().slice(-2))
  
  // Conditional fields
  const [vesselName, setVesselName] = useState('')
  const [containerNumber, setContainerNumber] = useState('')
  const [countryCode, setCountryCode] = useState('UK')
  const [fbaShipmentId, setFbaShipmentId] = useState('')
  const [location, setLocation] = useState('')
  const [shortTag, setShortTag] = useState('')
  const [department, setDepartment] = useState('')
  const [region, setRegion] = useState('UK')
  
  // SKU Management
  const [skuBatches, setSKUBatches] = useState<SKUBatch[]>([{ id: '1', sku: '', batchNumber: '' }])
  const [currentSKU, setCurrentSKU] = useState('')
  const [currentBatch, setCurrentBatch] = useState('')
  
  const [results, setResults] = useState<SOPResult[]>([])
  const [loading, setLoading] = useState(false)
  
  // Validation errors and warnings
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [validationWarnings, setValidationWarnings] = useState<Record<string, string>>({})

  // Reset form when account changes
  useEffect(() => {
    setServiceType('')
    setResults([])
  }, [chartOfAccount])

  // Get available service types for selected account
  const getServiceTypesForAccount = (): string[] => {
    const yearData = sopData[year] as any
    if (!chartOfAccount || !yearData || !yearData[chartOfAccount]) return []
    const types = yearData[chartOfAccount].map((item: any) => item.serviceType)
    return [...new Set(types)] as string[]
  }

  // Validate field and update error state
  const validateField = (fieldName: string, value: string): boolean => {
    let result: ValidationResult = { isValid: true };
    
    if (fieldName.startsWith('sku')) {
      result = validateSKU(value);
    } else if (fieldName.startsWith('batchNumber')) {
      result = validateBatchNumber(value);
    } else {
      switch (fieldName) {
        case 'invoiceNumber':
          result = validateInvoiceNumber(value);
          break;
        case 'containerNumber':
          result = validateContainerNumber(value);
          break;
        case 'fbaShipmentId':
          result = validateFBAShipmentId(value);
          break;
        case 'vesselName':
          result = validateVesselName(value);
          break;
      }
    }
    
    // Handle errors
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      if (result.isValid || !result.error) {
        delete newErrors[fieldName];
      } else {
        newErrors[fieldName] = result.error;
      }
      return newErrors;
    });
    
    // Handle warnings
    setValidationWarnings(prev => {
      const newWarnings = { ...prev };
      if (result.warning) {
        newWarnings[fieldName] = result.warning;
      } else {
        delete newWarnings[fieldName];
      }
      return newWarnings;
    });
    
    return result.isValid;
  }

  // Check what fields are needed based on current selection
  const needsInvoiceNumber = chartOfAccount && !chartOfAccount.includes('Prepayments')
  const needsMJNumber = chartOfAccount?.includes('Prepayments')
  
  const needsVessel = chartOfAccount?.includes('Freight & Custom Duty') || 
                     (chartOfAccount?.includes('3PL') && serviceType === 'Container Unloading')
  
  const needsFBA = chartOfAccount?.includes('Land Freight') || 
                  (chartOfAccount?.includes('3PL') && serviceType === 'Outbound Handling')
  
  const needsFrequency = chartOfAccount?.includes('Contract Salaries') || 
                        chartOfAccount?.includes('Overseas VAT') || 
                        chartOfAccount?.includes('IT Software') || 
                        chartOfAccount?.includes('Telephone') ||
                        chartOfAccount?.includes('VAT')
  
  const needsPeriod = needsFrequency ||
                     chartOfAccount?.includes('Accounting') ||
                     (chartOfAccount?.includes('Research & Development') && serviceType?.includes('Subscription'))
  
  const needsPeriodRange = frequency === 'Quarterly' && chartOfAccount?.includes('VAT')
  
  const needsManufacturingLocation = year === '2024' && chartOfAccount?.includes('Manufacturing')
  
  const needsDepartment = chartOfAccount?.includes('Contract Salaries') || 
                         chartOfAccount?.includes('General Operating') || 
                         chartOfAccount?.includes('IT Software') || 
                         chartOfAccount?.includes('Telephone')
  
  const needsRegion = chartOfAccount?.includes('Accounting') || 
                     chartOfAccount?.includes('Legal') || 
                     chartOfAccount?.includes('VAT') || 
                     chartOfAccount?.includes('Interest')
  
  const needsSKU = chartOfAccount?.includes('3PL') || 
                  chartOfAccount?.includes('Manufacturing') || 
                  chartOfAccount?.includes('Freight') || 
                  chartOfAccount?.includes('Land Freight')

  // Add SKU/Batch
  const addSKUBatch = () => {
    if (!currentSKU.trim()) {
      toast.error('Please enter SKU')
      return
    }
    
    // Validate
    if (!validateField('sku_current', currentSKU)) {
      return
    }
    
    if (currentBatch && !validateField('batchNumber_current', currentBatch)) {
      return
    }
    
    setSKUBatches([...skuBatches, {
      id: Date.now().toString(),
      sku: currentSKU,
      batchNumber: currentBatch
    }])
    
    setCurrentSKU('')
    setCurrentBatch('')
  }

  // Remove SKU/Batch
  const removeSKUBatch = (id: string) => {
    setSKUBatches(skuBatches.filter(item => item.id !== id))
  }

  // Generate SOPs
  const generateSOPs = () => {
    // Validate required fields
    if (needsInvoiceNumber && !invoiceNumber) {
      toast.error('Please enter invoice number')
      return
    }

    if (needsMJNumber && !mjNumber) {
      toast.error('Please enter MJ number for prepayments')
      return
    }

    if (!chartOfAccount || !serviceType) {
      toast.error('Please select account and service type')
      return
    }

    // Validate fields
    let hasErrors = false
    
    if (needsInvoiceNumber && !validateField('invoiceNumber', invoiceNumber)) {
      hasErrors = true
    }
    
    if (needsVessel) {
      if (vesselName && !validateField('vesselName', vesselName)) {
        hasErrors = true
      }
      if (containerNumber && !validateField('containerNumber', containerNumber)) {
        hasErrors = true
      }
    }
    
    if (needsFBA && fbaShipmentId && !validateField('fbaShipmentId', fbaShipmentId)) {
      hasErrors = true
    }
    
    if (hasErrors) {
      toast.error('Please fix validation errors before generating')
      return
    }

    setLoading(true)
    const newResults: SOPResult[] = []
    
    setTimeout(() => {
      const yearData = sopData[year] as any
      if (!yearData) {
        toast.error('SOP data not loaded yet')
        setLoading(false)
        return
      }
      
      const sopRules = yearData[chartOfAccount] || []
      const rule = sopRules.find((r: any) => r.serviceType === serviceType)
      
      if (!rule) {
        toast.error(`No SOP rule found for ${chartOfAccount} - ${serviceType}`)
        setLoading(false)
        return
      }
      
      // Format periods
      const formattedPeriod = `${periodMonth}${periodYear}`
      const formattedPeriodEnd = needsPeriodRange ? `${periodEndMonth}${periodEndYear}` : ''
      
      // Generate for each SKU or single result
      const itemsToGenerate = needsSKU && skuBatches.length > 0 ? skuBatches : [{ id: '1', sku: '', batchNumber: '' }]
      
      itemsToGenerate.forEach((item) => {
        // Generate reference based on template
        let reference = rule.referenceTemplate
          .replace('<Invoice#>', invoiceNumber)
          .replace('<InternalInvoice#>', invoiceNumber)
          .replace('<MJ#>', mjNumber)
          .replace('<Frequency>', frequency)
          .replace('[Month Year]', formattedPeriod)
          .replace('<PeriodMonthYear>', formattedPeriod)
          .replace('<Vessel Name>', vesselName)
          .replace('<Container #>', containerNumber)
          .replace('<Country Code>', countryCode)
          .replace('<FBA Shipment Plan ID>', fbaShipmentId)
          .replace('<Location>', location)
        
        // Generate description based on template
        let description = rule.descriptionTemplate
          .replace('<Department>', department)
          .replace('<Service>', serviceType)
          .replace('<ShortTag>', shortTag || 'Description')
          .replace('<SKU>', item.sku)
          .replace('<Batch #>', item.batchNumber)
          .replace('<Region>', region)
          .replace('<Frequency>', frequency)
          .replace('<PeriodStartMonthYear>', formattedPeriod)
          .replace('<PeriodEndMonthYear>', formattedPeriodEnd || formattedPeriod)
        
        // Handle special cases
        if (description.includes('Follow existing format')) {
          description = 'Please follow existing transaction format'
        }
        
        newResults.push({
          id: Date.now().toString() + '_' + item.id,
          reference,
          description,
          sku: item.sku,
          batchNumber: item.batchNumber
        })
      })
      
      setResults(newResults)
      setLoading(false)
      toast.success(`Generated ${newResults.length} SOP(s) successfully!`)
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
    setMjNumber('')
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
    setDepartment('')
    setRegion('UK')
    setSKUBatches([{ id: '1', sku: '', batchNumber: '' }])
    setCurrentSKU('')
    setCurrentBatch('')
    setResults([])
    setValidationErrors({})
    setValidationWarnings({})
  }


  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Toaster position="top-right" toastOptions={{ id: toasterId }} />
      
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center">
              <Zap className="h-8 w-8 mr-3 text-emerald-400" />
              SOP Reference Generator
            </h1>
            <p className="text-gray-400">
              Generate standardized references and descriptions based on SOPs
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
      
      {/* Main Card */}
      <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 mb-6">
        {/* Year Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            SOP Year
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

        {/* Account Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Chart of Account <span className="text-red-400">*</span>
          </label>
          <select
            value={chartOfAccount}
            onChange={(e) => setChartOfAccount(e.target.value)}
            className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
          >
            <option value="">Select Account</option>
            {sopData[year] && Object.keys(sopData[year]).map(account => (
              <option key={account} value={account}>{account}</option>
            ))}
          </select>
        </div>

        {/* Service Type - Shows after account selection */}
        {chartOfAccount && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Service Type <span className="text-red-400">*</span>
            </label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Select Service Type</option>
              {getServiceTypesForAccount().map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        )}

        {/* Dynamic Fields - Show after service type selection */}
        {serviceType && (
          <div className="space-y-6">
            {/* Invoice/MJ Number */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {needsInvoiceNumber && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Invoice Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => {
                      const value = e.target.value
                      setInvoiceNumber(value)
                      validateField('invoiceNumber', value)
                    }}
                    placeholder="Enter invoice number"
                    className={`w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border ${validationErrors.invoiceNumber ? 'border-red-500' : 'border-slate-600'} focus:border-emerald-500 focus:outline-none placeholder-gray-500`}
                  />
                  {validationErrors.invoiceNumber && (
                    <p className="mt-1 text-xs text-red-400">{validationErrors.invoiceNumber}</p>
                  )}
                </div>
              )}
              
              {needsMJNumber && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    MJ Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={mjNumber}
                    onChange={(e) => setMjNumber(e.target.value)}
                    placeholder="Enter MJ number"
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
              </div>
            </div>

            {/* Frequency and Period */}
            {(needsFrequency || needsPeriod) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {needsFrequency && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Frequency
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
                
                {needsPeriod && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Period {needsPeriodRange && '(Start)'}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={periodMonth}
                          onChange={(e) => setPeriodMonth(e.target.value)}
                          className="px-3 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                        >
                          {months.map(month => (
                            <option key={month} value={month}>{month}</option>
                          ))}
                        </select>
                        <select
                          value={periodYear}
                          onChange={(e) => setPeriodYear(e.target.value)}
                          className="px-3 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
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
                            className="px-3 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                          >
                            {months.map(month => (
                              <option key={month} value={month}>{month}</option>
                            ))}
                          </select>
                          <select
                            value={periodEndYear}
                            onChange={(e) => setPeriodEndYear(e.target.value)}
                            className="px-3 py-2 bg-slate-700/50 text-white rounded-lg border border-slate-600 focus:border-emerald-500 focus:outline-none"
                          >
                            {years.map(yr => (
                              <option key={yr} value={yr}>20{yr}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Department/Region */}
            {(needsDepartment || needsRegion) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {needsDepartment && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Department
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
                
                {needsRegion && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Region
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
              </div>
            )}

            {/* Vessel/Container */}
            {needsVessel && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Vessel Name
                  </label>
                  <input
                    type="text"
                    value={vesselName}
                    onChange={(e) => {
                      const value = e.target.value
                      setVesselName(value)
                      validateField('vesselName', value)
                    }}
                    placeholder="e.g., OOCL Spain"
                    className={`w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border ${validationErrors.vesselName ? 'border-red-500' : 'border-slate-600'} focus:border-emerald-500 focus:outline-none placeholder-gray-500`}
                  />
                  {validationErrors.vesselName && (
                    <p className="mt-1 text-xs text-red-400">{validationErrors.vesselName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Container Number
                  </label>
                  <input
                    type="text"
                    value={containerNumber}
                    onChange={(e) => {
                      const value = formatContainerNumber(e.target.value)
                      setContainerNumber(value)
                      validateField('containerNumber', value)
                    }}
                    placeholder="e.g., OOCU8157379"
                    className={`w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border ${validationErrors.containerNumber ? 'border-red-500' : 'border-slate-600'} focus:border-emerald-500 focus:outline-none placeholder-gray-500`}
                  />
                  {validationErrors.containerNumber && (
                    <p className="mt-1 text-xs text-red-400">{validationErrors.containerNumber}</p>
                  )}
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
              </div>
            )}

            {/* FBA/Location */}
            {needsFBA && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    FBA Shipment Plan ID
                  </label>
                  <input
                    type="text"
                    value={fbaShipmentId}
                    onChange={(e) => {
                      const value = formatFBAShipmentId(e.target.value)
                      setFbaShipmentId(value)
                      validateField('fbaShipmentId', value)
                    }}
                    placeholder="e.g., FBA15JNS7SYV"
                    className={`w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border ${validationErrors.fbaShipmentId ? 'border-red-500' : 'border-slate-600'} focus:border-emerald-500 focus:outline-none placeholder-gray-500`}
                  />
                  {validationErrors.fbaShipmentId && (
                    <p className="mt-1 text-xs text-red-400">{validationErrors.fbaShipmentId}</p>
                  )}
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
              </div>
            )}

            {/* Manufacturing Location */}
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

            {/* SKU Management */}
            {needsSKU && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-300">SKU & Batch Numbers</h3>
                
                {/* SKU Input */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <input
                      type="text"
                      value={currentSKU}
                      onChange={(e) => {
                        const value = formatSKU(e.target.value)
                        setCurrentSKU(value)
                        validateField('sku_current', value)
                      }}
                      onKeyPress={(e) => e.key === 'Enter' && addSKUBatch()}
                      placeholder="SKU (e.g., CS-007)"
                      className={`w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border ${validationErrors.sku_current ? 'border-red-500' : 'border-slate-600'} focus:border-emerald-500 focus:outline-none placeholder-gray-500`}
                    />
                    {validationErrors.sku_current && (
                      <p className="mt-1 text-xs text-red-400">{validationErrors.sku_current}</p>
                    )}
                  </div>
                  <div>
                    <input
                      type="text"
                      value={currentBatch}
                      onChange={(e) => {
                        const value = formatBatchNumber(e.target.value)
                        setCurrentBatch(value)
                        validateField('batchNumber_current', value)
                      }}
                      onKeyPress={(e) => e.key === 'Enter' && addSKUBatch()}
                      placeholder="Batch # (optional)"
                      className={`w-full px-4 py-2 bg-slate-700/50 text-white rounded-lg border ${validationErrors.batchNumber_current ? 'border-red-500' : 'border-slate-600'} focus:border-emerald-500 focus:outline-none placeholder-gray-500`}
                    />
                    {validationErrors.batchNumber_current && (
                      <p className="mt-1 text-xs text-red-400">{validationErrors.batchNumber_current}</p>
                    )}
                  </div>
                  <div>
                    <button
                      onClick={addSKUBatch}
                      className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all flex items-center justify-center"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add SKU
                    </button>
                  </div>
                </div>
                
                {/* SKU List */}
                {skuBatches.length > 0 && skuBatches.some(s => s.sku) && (
                  <div className="bg-slate-900/50 rounded-lg p-4">
                    <div className="space-y-2">
                      {skuBatches.filter(s => s.sku).map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 bg-slate-800/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Check className="h-4 w-4 text-emerald-400" />
                            <span className="text-white">
                              {item.sku}
                              {item.batchNumber && <span className="text-gray-400 ml-2">Batch {item.batchNumber}</span>}
                            </span>
                          </div>
                          <button
                            onClick={() => removeSKUBatch(item.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {skuBatches.filter(s => s.sku).length} SKU(s) will generate {skuBatches.filter(s => s.sku).length} reference(s)
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Generate Button */}
        {serviceType && (
          <div className="mt-8 flex gap-4 justify-center">
            <button
              onClick={generateSOPs}
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
        )}
      </div>
      
      {/* Results */}
      {results.length > 0 && (
        <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Generated SOPs</h3>
          <div className="space-y-4">
            {results.map((result, index) => (
              <div key={result.id} className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-300">
                    Result #{index + 1}
                    {result.sku && <span className="text-emerald-400 ml-2">({result.sku}{result.batchNumber && ` - Batch ${result.batchNumber}`})</span>}
                  </h4>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Reference</p>
                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                      <code className="text-sm text-emerald-400 font-mono">{result.reference}</code>
                      <button
                        onClick={() => copyToClipboard(result.reference, 'Reference')}
                        className="text-emerald-400 hover:text-emerald-300 transition-colors p-1"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Description</p>
                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                      <p className="text-sm text-white">{result.description}</p>
                      <button
                        onClick={() => copyToClipboard(result.description, 'Description')}
                        className="text-emerald-400 hover:text-emerald-300 transition-colors p-1"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Instructions */}
      <div className="mt-8 bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Info className="h-5 w-5 mr-2 text-cyan-400" />
          How to Use
        </h3>
        <ol className="space-y-2 text-gray-300 text-sm">
          <li>1. Select the SOP year (2024 or 2025)</li>
          <li>2. Choose the Chart of Account</li>
          <li>3. Select the Service Type</li>
          <li>4. Fill in the fields that appear (they change based on your selection)</li>
          <li>5. For SKU-based accounts, add multiple SKUs to generate multiple references</li>
          <li>6. Click &quot;Generate SOPs&quot; to create references and descriptions</li>
          <li>7. Copy the results as needed</li>
        </ol>
      </div>
    </div>
  )
}

