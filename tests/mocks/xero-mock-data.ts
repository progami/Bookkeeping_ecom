export const mockXeroData = {
  // Mock Xero connection status
  connectionStatus: {
    connected: true,
    tenantId: 'mock-tenant-id',
    tenantName: 'Mock Organization',
    lastSyncedAt: new Date().toISOString()
  },

  // Mock bank accounts
  bankAccounts: [
    {
      accountID: 'acc-001',
      code: '090',
      name: 'Business Bank Account',
      type: 'BANK',
      bankAccountNumber: '12-3456-7890123-00',
      status: 'ACTIVE',
      bankAccountType: 'BANK',
      currencyCode: 'NZD',
      hasAttachments: false,
      updatedDateUTC: new Date().toISOString()
    },
    {
      accountID: 'acc-002',
      code: '091', 
      name: 'Savings Account',
      type: 'BANK',
      bankAccountNumber: '12-3456-7890123-01',
      status: 'ACTIVE',
      bankAccountType: 'BANK',
      currencyCode: 'NZD',
      hasAttachments: false,
      updatedDateUTC: new Date().toISOString()
    }
  ],

  // Mock transactions
  transactions: [
    {
      transactionID: 'txn-001',
      type: 'SPEND',
      status: 'AUTHORISED',
      lineAmountTypes: 'Exclusive',
      date: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Yesterday
      dueDate: null,
      bankAccount: {
        accountID: 'acc-001',
        code: '090',
        name: 'Business Bank Account'
      },
      contact: {
        contactID: 'con-001',
        name: 'Office Supplies Ltd'
      },
      lineItems: [
        {
          description: 'Office supplies - pens and paper',
          quantity: 1,
          unitAmount: 125.50,
          accountCode: '400',
          taxType: 'INPUT2',
          taxAmount: 18.83,
          lineAmount: 125.50,
          tracking: []
        }
      ],
      total: 144.33,
      totalTax: 18.83,
      subTotal: 125.50,
      reference: 'INV-2024-001',
      currencyCode: 'NZD',
      isReconciled: false,
      hasAttachments: false,
      updatedDateUTC: new Date().toISOString()
    },
    {
      transactionID: 'txn-002',
      type: 'SPEND',
      status: 'AUTHORISED',
      lineAmountTypes: 'Exclusive',
      date: new Date(Date.now() - 172800000).toISOString().split('T')[0], // 2 days ago
      dueDate: null,
      bankAccount: {
        accountID: 'acc-001',
        code: '090',
        name: 'Business Bank Account'
      },
      contact: {
        contactID: 'con-002',
        name: 'Tech Solutions Inc'
      },
      lineItems: [
        {
          description: 'Software subscription - monthly',
          quantity: 1,
          unitAmount: 99.00,
          accountCode: '453',
          taxType: 'INPUT2',
          taxAmount: 14.85,
          lineAmount: 99.00,
          tracking: []
        }
      ],
      total: 113.85,
      totalTax: 14.85,
      subTotal: 99.00,
      reference: 'SUB-2024-03',
      currencyCode: 'NZD',
      isReconciled: true,
      hasAttachments: false,
      updatedDateUTC: new Date().toISOString()
    },
    {
      transactionID: 'txn-003',
      type: 'RECEIVE',
      status: 'AUTHORISED',
      lineAmountTypes: 'Exclusive',
      date: new Date(Date.now() - 259200000).toISOString().split('T')[0], // 3 days ago
      dueDate: null,
      bankAccount: {
        accountID: 'acc-001',
        code: '090',
        name: 'Business Bank Account'
      },
      contact: {
        contactID: 'con-003',
        name: 'Client ABC Ltd'
      },
      lineItems: [
        {
          description: 'Consulting services - March 2024',
          quantity: 1,
          unitAmount: 2500.00,
          accountCode: '200',
          taxType: 'OUTPUT2',
          taxAmount: 375.00,
          lineAmount: 2500.00,
          tracking: []
        }
      ],
      total: 2875.00,
      totalTax: 375.00,
      subTotal: 2500.00,
      reference: 'INV-OUT-2024-015',
      currencyCode: 'NZD',
      isReconciled: false,
      hasAttachments: false,
      updatedDateUTC: new Date().toISOString()
    }
  ],

  // Mock GL accounts
  glAccounts: [
    {
      accountID: 'gl-001',
      code: '200',
      name: 'Sales',
      type: 'REVENUE',
      status: 'ACTIVE',
      description: 'Income from any normal business activity',
      taxType: 'OUTPUT2',
      enablePaymentsToAccount: false,
      showInExpenseClaims: false,
      class: 'REVENUE',
      reportingCode: 'REV',
      reportingCodeName: 'Revenue',
      hasAttachments: false,
      updatedDateUTC: new Date().toISOString()
    },
    {
      accountID: 'gl-002',
      code: '400',
      name: 'Advertising',
      type: 'EXPENSE',
      status: 'ACTIVE',
      description: 'Expenses incurred for advertising and marketing',
      taxType: 'INPUT2',
      enablePaymentsToAccount: false,
      showInExpenseClaims: true,
      class: 'EXPENSE',
      reportingCode: 'EXP',
      reportingCodeName: 'Expense',
      hasAttachments: false,
      updatedDateUTC: new Date().toISOString()
    },
    {
      accountID: 'gl-003',
      code: '453',
      name: 'Computer Expenses',
      type: 'EXPENSE',
      status: 'ACTIVE',
      description: 'Expenses incurred from computer hardware and software',
      taxType: 'INPUT2',
      enablePaymentsToAccount: false,
      showInExpenseClaims: true,
      class: 'EXPENSE',
      reportingCode: 'EXP',
      reportingCodeName: 'Expense',
      hasAttachments: false,
      updatedDateUTC: new Date().toISOString()
    }
  ],

  // Mock stats for dashboard
  stats: {
    totalTransactions: 3,
    reconciledCount: 1,
    unreconciledCount: 2,
    totalIncome: 2875.00,
    totalExpenses: 258.18,
    netCashFlow: 2616.82,
    accountBalances: {
      'acc-001': 5234.56,
      'acc-002': 10000.00
    }
  }
}

// Helper to generate more transactions if needed
export function generateMockTransactions(count: number, startDate: Date) {
  const transactions = []
  const types = ['SPEND', 'RECEIVE']
  const suppliers = ['Office Depot', 'Amazon Business', 'Staples', 'Tech Store']
  const clients = ['Client XYZ', 'Customer 123', 'Big Corp Ltd', 'Small Biz Inc']
  const expenseCategories = [
    { code: '400', name: 'Advertising' },
    { code: '453', name: 'Computer Expenses' },
    { code: '420', name: 'Entertainment' },
    { code: '429', name: 'General Expenses' }
  ]

  for (let i = 0; i < count; i++) {
    const isExpense = types[Math.floor(Math.random() * types.length)] === 'SPEND'
    const amount = Math.floor(Math.random() * 1000) + 50
    const taxRate = 0.15
    const taxAmount = amount * taxRate
    
    transactions.push({
      transactionID: `txn-gen-${i}`,
      type: isExpense ? 'SPEND' : 'RECEIVE',
      status: 'AUTHORISED',
      lineAmountTypes: 'Exclusive',
      date: new Date(startDate.getTime() - (i * 86400000)).toISOString().split('T')[0],
      dueDate: null,
      bankAccount: mockXeroData.bankAccounts[0],
      contact: {
        contactID: `con-gen-${i}`,
        name: isExpense 
          ? suppliers[Math.floor(Math.random() * suppliers.length)]
          : clients[Math.floor(Math.random() * clients.length)]
      },
      lineItems: [{
        description: isExpense ? 'Business expense' : 'Service rendered',
        quantity: 1,
        unitAmount: amount,
        accountCode: isExpense 
          ? expenseCategories[Math.floor(Math.random() * expenseCategories.length)].code
          : '200',
        taxType: isExpense ? 'INPUT2' : 'OUTPUT2',
        taxAmount: taxAmount,
        lineAmount: amount,
        tracking: []
      }],
      total: amount + taxAmount,
      totalTax: taxAmount,
      subTotal: amount,
      reference: `${isExpense ? 'EXP' : 'INV'}-${new Date().getFullYear()}-${String(i).padStart(3, '0')}`,
      currencyCode: 'NZD',
      isReconciled: Math.random() > 0.7,
      hasAttachments: false,
      updatedDateUTC: new Date().toISOString()
    })
  }

  return transactions
}