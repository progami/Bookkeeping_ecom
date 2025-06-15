import { sopData } from '@/lib/sop-data'

// Test data for each Chart of Account
const testCases = [
  // 2025 Tests
  {
    year: '2025',
    account: '321 - Contract Salaries',
    serviceType: 'Salary',
    inputs: {
      invoiceNumber: 'TDE24001',
      frequency: 'Monthly',
      periodMonth: 'Oct',
      periodYear: '24',
      department: 'Operations',
      shortTag: 'TestUser'
    },
    expected: {
      reference: 'TDE24001_Monthly_Oct24',
      description: 'Operations_Salary_TestUser'
    }
  },
  {
    year: '2025',
    account: '331 - 3PL',
    serviceType: 'Container Unloading',
    inputs: {
      invoiceNumber: 'VUK00003643',
      vesselName: 'OOCL Spain',
      containerNumber: 'OOCU8157379',
      countryCode: 'UK',
      sku: 'CS-007',
      batchNumber: '12',
      shortTag: 'Test'
    },
    expected: {
      reference: 'VUK00003643_OOCL Spain_OOCU8157379_UK',
      description: 'CS-007_12_Container Unloading_Test'
    }
  },
  {
    year: '2025',
    account: '330 - Manufacturing',
    serviceType: 'Production',
    inputs: {
      invoiceNumber: 'PI-2406202',
      sku: 'CS-007',
      batchNumber: '12',
      shortTag: 'Test'
    },
    expected: {
      reference: 'PI-2406202',
      description: 'CS-007_12_Production_Test'
    }
  },
  {
    year: '2025',
    account: '820 - VAT',
    serviceType: 'VAT Paid',
    inputs: {
      invoiceNumber: '67734',
      frequency: 'Quarterly',
      periodMonth: 'Jan',
      periodYear: '25',
      periodEndMonth: 'Mar',
      periodEndYear: '25'
    },
    expected: {
      reference: '67734',
      description: 'Quarterly_Jan25_Mar25'
    }
  },
  // 2024 Tests
  {
    year: '2024',
    account: '330 - Manufacturing',
    serviceType: 'Production',
    inputs: {
      invoiceNumber: 'PI-2406202',
      location: 'Jiangsu Guangyun Electromechanical Co., Ltd.',
      sku: 'CS-007',
      batchNumber: '12',
      shortTag: 'Test'
    },
    expected: {
      reference: 'PI-2406202 - Jiangsu Guangyun Electromechanical Co., Ltd.',
      description: 'CS-007 - Batch 12 - Production - Test'
    }
  }
]

// Function to generate SOP (mimicking the SOP generator logic)
function generateSOP(year: string, account: string, serviceType: string, inputs: any) {
  const yearData = sopData[year as keyof typeof sopData]
  if (!yearData) return null

  const accountData = yearData[account as keyof typeof yearData]
  if (!accountData || !Array.isArray(accountData)) return null

  const rule = accountData.find((r: any) => r.serviceType === serviceType)
  if (!rule) return null

  // Format periods
  const formattedPeriod = inputs.periodMonth && inputs.periodYear 
    ? `${inputs.periodMonth}${inputs.periodYear}` 
    : ''
  const formattedPeriodEnd = inputs.periodEndMonth && inputs.periodEndYear 
    ? `${inputs.periodEndMonth}${inputs.periodEndYear}` 
    : ''

  // Generate reference
  let reference = rule.referenceTemplate
    .replace('<Invoice#>', inputs.invoiceNumber || '')
    .replace('<InternalInvoice#>', inputs.invoiceNumber || '')
    .replace('<MJ#>', inputs.mjNumber || '')
    .replace('<Frequency>', inputs.frequency || '')
    .replace('[Month Year]', formattedPeriod)
    .replace('<PeriodMonthYear>', formattedPeriod)
    .replace('<Vessel Name>', inputs.vesselName || '')
    .replace('<Container #>', inputs.containerNumber || '')
    .replace('<Country Code>', inputs.countryCode || '')
    .replace('<FBA Shipment Plan ID>', inputs.fbaShipmentId || '')
    .replace('<Location>', inputs.location || '')

  // Generate description
  let description = rule.descriptionTemplate
    .replace('<Department>', inputs.department || '')
    .replace('<Service>', serviceType)
    .replace('<ShortTag>', inputs.shortTag || 'Description')
    .replace('<SKU>', inputs.sku || '')
    .replace('<Batch #>', inputs.batchNumber || '')
    .replace('<Region>', inputs.region || '')
    .replace('<Frequency>', inputs.frequency || '')
    .replace('<PeriodStartMonthYear>', formattedPeriod)
    .replace('<PeriodEndMonthYear>', formattedPeriodEnd || formattedPeriod)

  return { reference, description }
}

// Run tests
console.log('Testing SOP Generator...\n')

let passed = 0
let failed = 0

testCases.forEach((test, index) => {
  console.log(`Test ${index + 1}: ${test.year} - ${test.account} - ${test.serviceType}`)
  
  const result = generateSOP(test.year, test.account, test.serviceType, test.inputs)
  
  if (!result) {
    console.log('❌ FAILED: No SOP rule found')
    failed++
    return
  }

  const referenceMatch = result.reference === test.expected.reference
  const descriptionMatch = result.description === test.expected.description

  if (referenceMatch && descriptionMatch) {
    console.log('✅ PASSED')
    passed++
  } else {
    console.log('❌ FAILED')
    if (!referenceMatch) {
      console.log(`  Reference mismatch:`)
      console.log(`    Expected: "${test.expected.reference}"`)
      console.log(`    Got:      "${result.reference}"`)
    }
    if (!descriptionMatch) {
      console.log(`  Description mismatch:`)
      console.log(`    Expected: "${test.expected.description}"`)
      console.log(`    Got:      "${result.description}"`)
    }
    failed++
  }
  console.log('')
})

console.log(`\nTest Summary: ${passed} passed, ${failed} failed out of ${testCases.length} tests`)

// Test all Chart of Accounts have valid data
console.log('\nValidating all Chart of Accounts...')
const years = ['2024', '2025'] as const

years.forEach(year => {
  const yearData = sopData[year]
  const accounts = Object.keys(yearData)
  
  console.log(`\n${year}: ${accounts.length} accounts`)
  
  accounts.forEach(account => {
    const accountData = yearData[account as keyof typeof yearData]
    if (!Array.isArray(accountData) || accountData.length === 0) {
      console.log(`⚠️  ${account}: No service types defined`)
    } else {
      console.log(`✅ ${account}: ${accountData.length} service types`)
    }
  })
})

export {}