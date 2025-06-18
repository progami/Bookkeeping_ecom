'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check, Calendar, Package, Settings, Download, Sparkles,
  ChevronRight, AlertCircle, Loader2, Building2, Database
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import toast, { Toaster } from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface ImportOptions {
  dateRange: 'last_3_months' | 'last_6_months' | 'last_12_months' | 'all'
  entities: string[]
  categories: 'auto_map' | 'manual_map'
}

interface ImportProgress {
  status: 'idle' | 'importing' | 'completed' | 'error'
  currentEntity: string
  totalRecords: number
  processedRecords: number
  errors: string[]
}

const steps = [
  {
    id: 1,
    title: "Welcome",
    description: "Let's set up your financial hub",
    icon: Sparkles
  },
  {
    id: 2,
    title: "Select Data",
    description: "Choose what to import from Xero",
    icon: Package
  },
  {
    id: 3,
    title: "Configure",
    description: "Set your import preferences",
    icon: Settings
  },
  {
    id: 4,
    title: "Import",
    description: "Syncing your data",
    icon: Download
  },
  {
    id: 5,
    title: "Complete",
    description: "Ready to go!",
    icon: Check
  }
]

export default function SetupPage() {
  const router = useRouter()
  const { organization, hasActiveToken, syncData } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    dateRange: 'last_3_months',
    entities: ['accounts', 'transactions', 'invoices', 'contacts'],
    categories: 'auto_map'
  })
  const [importProgress, setImportProgress] = useState<ImportProgress>({
    status: 'idle',
    currentEntity: '',
    totalRecords: 0,
    processedRecords: 0,
    errors: []
  })
  const [isImporting, setIsImporting] = useState(false)
  const importStartedRef = useRef(false)

  useEffect(() => {
    // Redirect if not connected to Xero
    if (!hasActiveToken) {
      router.push('/connect')
    }
  }, [hasActiveToken, router])

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
      
      // Start import when reaching step 4
      if (currentStep === 3) {
        startImport()
      }
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const startImport = async () => {
    // Prevent multiple calls using ref
    if (importStartedRef.current || isImporting || importProgress.status === 'completed') {
      return
    }
    
    importStartedRef.current = true
    setIsImporting(true)
    setImportProgress({ ...importProgress, status: 'importing' })
    
    try {
      // Configure import settings
      await fetch('/api/v1/setup/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importOptions)
      })

      // Since we already synced data when connecting to Xero,
      // we'll just mark the progress as complete
      setImportProgress(prev => ({
        ...prev,
        currentEntity: 'Data already synced',
        totalRecords: 100,
        processedRecords: 100,
        status: 'completed'
      }))
      
      // Mark setup as complete
      const completeResponse = await fetch('/api/v1/setup/complete', { 
        method: 'POST',
        credentials: 'include'
      })
      
      if (!completeResponse.ok) {
        throw new Error('Failed to mark setup as complete')
      }
      
      toast.success('Setup completed successfully!')
      
      // Move to next step immediately
      setCurrentStep(5)
    } catch (error: any) {
      setImportProgress(prev => ({
        ...prev,
        status: 'error',
        errors: [error.message]
      }))
      toast.error('Setup failed: ' + error.message)
    } finally {
      setIsImporting(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 bg-brand-emerald/20 rounded-full flex items-center justify-center mx-auto">
              <Building2 className="h-10 w-10 text-brand-emerald" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Welcome to {organization?.tenantName || 'Your Financial Hub'}
              </h2>
              <p className="text-gray-400">
                Let&apos;s get your financial data set up. This will only take a few minutes.
              </p>
            </div>
            <div className="grid gap-4 text-left max-w-md mx-auto">
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-brand-emerald mt-0.5" />
                <div>
                  <p className="font-medium text-white">Connected to Xero</p>
                  <p className="text-sm text-gray-400">Your account is linked and ready</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Database className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium text-white">Import Your Data</p>
                  <p className="text-sm text-gray-400">Select and sync your financial records</p>
                </div>
              </div>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Select Data to Import</h2>
              <p className="text-gray-400">Choose which data types you want to sync from Xero</p>
            </div>
            <div className="space-y-3">
              {[
                { id: 'accounts', label: 'Chart of Accounts', description: 'GL accounts and bank accounts' },
                { id: 'transactions', label: 'Bank Transactions', description: 'All bank transactions and reconciliations' },
                { id: 'invoices', label: 'Invoices', description: 'Sales and purchase invoices' },
                { id: 'contacts', label: 'Contacts', description: 'Customers and suppliers' }
              ].map(entity => (
                <label
                  key={entity.id}
                  className="flex items-start gap-3 p-4 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors border border-slate-700 hover:border-emerald-500/50"
                  onClick={(e) => {
                    e.preventDefault()
                    const isChecked = importOptions.entities.includes(entity.id)
                    if (!isChecked) {
                      setImportOptions(prev => ({
                        ...prev,
                        entities: [...prev.entities, entity.id]
                      }))
                    } else {
                      setImportOptions(prev => ({
                        ...prev,
                        entities: prev.entities.filter(e => e !== entity.id)
                      }))
                    }
                  }}
                >
                  <Checkbox
                    checked={importOptions.entities.includes(entity.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setImportOptions(prev => ({
                          ...prev,
                          entities: [...prev.entities, entity.id]
                        }))
                      } else {
                        setImportOptions(prev => ({
                          ...prev,
                          entities: prev.entities.filter(e => e !== entity.id)
                        }))
                      }
                    }}
                    className="mt-0.5"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-white">{entity.label}</p>
                    <p className="text-sm text-gray-400">{entity.description}</p>
                  </div>
                </label>
              ))}
            </div>
            {importOptions.entities.length === 0 && (
              <div className="text-center py-4 text-amber-400 text-sm">
                Please select at least one data type to import
              </div>
            )}
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Configure Import Settings</h2>
              <p className="text-gray-400">Choose how much historical data to import</p>
            </div>
            <div>
              <Label className="text-white mb-3 block">Date Range</Label>
              <RadioGroup
                value={importOptions.dateRange}
                onValueChange={(value: any) => setImportOptions(prev => ({ ...prev, dateRange: value }))}
              >
                <div className="space-y-2">
                  {[
                    { value: 'last_3_months', label: 'Last 3 months', description: 'Quick setup, recent data only' },
                    { value: 'last_6_months', label: 'Last 6 months', description: 'Half year of financial history' },
                    { value: 'last_12_months', label: 'Last 12 months', description: 'Full year for complete analysis' },
                    { value: 'all', label: 'All available data', description: 'Complete historical records' }
                  ].map(option => (
                    <label
                      key={option.value}
                      className="flex items-start gap-3 p-4 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors"
                    >
                      <RadioGroupItem value={option.value} className="mt-0.5" />
                      <div>
                        <p className="font-medium text-white">{option.label}</p>
                        <p className="text-sm text-gray-400">{option.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-white mb-2">Importing Your Data</h2>
              <p className="text-gray-400">This may take a few minutes depending on your data volume</p>
            </div>
            
            {importProgress.status === 'importing' && (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-brand-emerald animate-spin" />
                </div>
                
                {importProgress.currentEntity && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">
                        Importing {importProgress.currentEntity}...
                      </span>
                      <span className="text-white">
                        {importProgress.processedRecords} / {importProgress.totalRecords}
                      </span>
                    </div>
                    <Progress 
                      value={(importProgress.processedRecords / importProgress.totalRecords) * 100} 
                      className="h-2"
                    />
                  </div>
                )}
                
                <div className="grid gap-2 mt-6">
                  {importOptions.entities.map(entity => (
                    <div key={entity} className="flex items-center gap-2 text-sm">
                      {importProgress.currentEntity === entity ? (
                        <Loader2 className="h-4 w-4 text-brand-emerald animate-spin" />
                      ) : importOptions.entities.indexOf(entity) < importOptions.entities.indexOf(importProgress.currentEntity) ? (
                        <Check className="h-4 w-4 text-brand-emerald" />
                      ) : (
                        <div className="h-4 w-4 border border-gray-600 rounded-full" />
                      )}
                      <span className={cn(
                        "capitalize",
                        importProgress.currentEntity === entity ? "text-white" : "text-gray-400"
                      )}>
                        {entity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {importProgress.status === 'error' && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-400">Import Failed</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {importProgress.errors.join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )

      case 5:
        return (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 bg-brand-emerald/20 rounded-full flex items-center justify-center mx-auto">
              <Check className="h-10 w-10 text-brand-emerald" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Setup Complete!</h2>
              <p className="text-gray-400">
                Your financial data has been imported successfully
              </p>
            </div>
            <div className="bg-slate-800 rounded-lg p-6 text-left max-w-md mx-auto">
              <h3 className="font-medium text-white mb-3">What&apos;s Next?</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-brand-emerald mt-0.5" />
                  <span>Explore your financial dashboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-brand-emerald mt-0.5" />
                  <span>Review imported transactions</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-brand-emerald mt-0.5" />
                  <span>Set up automated reports</span>
                </li>
              </ul>
            </div>
            <Button
              onClick={() => router.push('/finance')}
              size="lg"
              className="min-w-[200px]"
            >
              Go to Dashboard
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-8">
      <Toaster position="top-right" />
      
      <div className="w-full max-w-2xl">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full transition-all",
                  currentStep > step.id
                    ? "bg-brand-emerald text-white"
                    : currentStep === step.id
                    ? "bg-brand-emerald/20 text-brand-emerald border-2 border-brand-emerald"
                    : "bg-slate-800 text-gray-500"
                )}>
                  {currentStep > step.id ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    "w-full h-0.5 mx-2",
                    currentStep > step.id ? "bg-brand-emerald" : "bg-slate-800"
                  )} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {steps.map(step => (
              <div key={step.id} className="text-center" style={{ width: '20%' }}>
                <p className={cn(
                  "text-xs",
                  currentStep >= step.id ? "text-white" : "text-gray-500"
                )}>
                  {step.title}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Content Card */}
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {renderStepContent()}
              </motion.div>
            </AnimatePresence>

            {/* Navigation Buttons */}
            {currentStep < 4 && (
              <div className="flex justify-between mt-8">
                <Button
                  variant="secondary"
                  onClick={handlePrevious}
                  disabled={currentStep === 1}
                  className={cn(currentStep === 1 && "invisible")}
                >
                  Previous
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={
                    (currentStep === 2 && importOptions.entities.length === 0) ||
                    (currentStep === 4 && importProgress.status === 'importing') ||
                    isImporting
                  }
                >
                  {currentStep === 3 ? 'Start Import' : 'Next'}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}