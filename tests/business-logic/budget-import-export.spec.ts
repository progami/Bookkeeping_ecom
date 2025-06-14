import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BudgetImportExport } from '@/lib/budget-import-export'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    cashFlowBudget: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    gLAccount: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('xlsx', () => ({
  utils: {
    book_new: vi.fn(() => ({})),
    json_to_sheet: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
    aoa_to_sheet: vi.fn(() => ({})),
    sheet_to_json: vi.fn(),
  },
  write: vi.fn(() => Buffer.from('mock excel')),
  read: vi.fn(),
}))

describe('BudgetImportExport', () => {
  let budgetImportExport: BudgetImportExport

  beforeEach(() => {
    budgetImportExport = new BudgetImportExport()
    vi.clearAllMocks()
  })

  describe('exportBudgets', () => {
    it('should export budgets to Excel format', async () => {
      const mockBudgets = [
        {
          accountCode: '400',
          accountName: 'Sales',
          category: 'REVENUE',
          monthYear: '2024-01',
          budgetedAmount: 10000,
          actualAmount: 9500,
          variance: -500,
          notes: 'January sales',
        },
        {
          accountCode: '500',
          accountName: 'Expenses',
          category: 'EXPENSE',
          monthYear: '2024-01',
          budgetedAmount: 5000,
          actualAmount: 5200,
          variance: 200,
          notes: null,
        },
      ]

      vi.mocked(prisma.cashFlowBudget.findMany).mockResolvedValue(mockBudgets as any)

      const buffer = await budgetImportExport.exportBudgets('2024-01', '2024-01')

      expect(prisma.cashFlowBudget.findMany).toHaveBeenCalledWith({
        where: {
          monthYear: {
            gte: '2024-01',
            lte: '2024-01',
          },
        },
        orderBy: [
          { monthYear: 'asc' },
          { accountCode: 'asc' },
        ],
      })

      expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            'Account Code': '400',
            'Account Name': 'Sales',
            'Category': 'REVENUE',
            'Month': '2024-01',
            'Budgeted Amount': 10000,
          }),
        ])
      )

      expect(buffer).toBeInstanceOf(Buffer)
    })
  })

  describe('importBudgets', () => {
    it('should import valid budget data', async () => {
      const mockData = [
        {
          'Account Code': '400',
          'Account Name': 'Sales',
          'Category': 'REVENUE',
          'Month': '2024-01',
          'Budgeted Amount': 10000,
          'Notes': 'Test import',
        },
      ]

      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as any)

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue(mockData)
      vi.mocked(prisma.cashFlowBudget.upsert).mockResolvedValue({} as any)

      const buffer = Buffer.from('test')
      const result = await budgetImportExport.importBudgets(buffer, 'test.xlsx')

      expect(result.success).toBe(true)
      expect(result.imported).toBe(1)
      expect(result.errors).toHaveLength(0)

      expect(prisma.cashFlowBudget.upsert).toHaveBeenCalledWith({
        where: {
          accountCode_monthYear: {
            accountCode: '400',
            monthYear: '2024-01',
          },
        },
        create: expect.objectContaining({
          accountCode: '400',
          accountName: 'Sales',
          category: 'REVENUE',
          monthYear: '2024-01',
          budgetedAmount: 10000,
          notes: 'Test import',
          importedFrom: 'manual_import',
        }),
        update: expect.objectContaining({
          budgetedAmount: 10000,
          notes: 'Test import',
        }),
      })
    })

    it('should validate required fields', async () => {
      const invalidData = [
        {
          'Account Name': 'Sales', // Missing Account Code
          'Category': 'REVENUE',
          'Month': '2024-01',
          'Budgeted Amount': 10000,
        },
      ]

      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as any)

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue(invalidData)

      const buffer = Buffer.from('test')
      const result = await budgetImportExport.importBudgets(buffer, 'test.xlsx')

      expect(result.success).toBe(false)
      expect(result.imported).toBe(0)
      expect(result.errors).toContain('Row 2: Account Code is required')
    })

    it('should validate category values', async () => {
      const invalidData = [
        {
          'Account Code': '400',
          'Account Name': 'Sales',
          'Category': 'INVALID_CATEGORY',
          'Month': '2024-01',
          'Budgeted Amount': 10000,
        },
      ]

      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as any)

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue(invalidData)

      const buffer = Buffer.from('test')
      const result = await budgetImportExport.importBudgets(buffer, 'test.xlsx')

      expect(result.success).toBe(false)
      expect(result.errors[0]).toContain('Invalid category')
    })

    it('should validate month format', async () => {
      const invalidData = [
        {
          'Account Code': '400',
          'Account Name': 'Sales',
          'Category': 'REVENUE',
          'Month': '01/2024', // Invalid format
          'Budgeted Amount': 10000,
        },
      ]

      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as any)

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue(invalidData)

      const buffer = Buffer.from('test')
      const result = await budgetImportExport.importBudgets(buffer, 'test.xlsx')

      expect(result.success).toBe(false)
      expect(result.errors[0]).toContain('Invalid month format')
    })
  })

  describe('importXeroBudgetExport', () => {
    it('should import Xero budget format', async () => {
      const xeroData = [
        ['Budget Report'],
        [''],
        ['Account', 'Jan-24', 'Feb-24', 'Mar-24'],
        ['200 - Sales', -10000, -12000, -11000],
        ['400 - Cost of Sales', 5000, 6000, 5500],
      ]

      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Budget'],
        Sheets: { Budget: {} },
      } as any)

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue(xeroData)
      vi.mocked(prisma.cashFlowBudget.upsert).mockResolvedValue({} as any)

      const buffer = Buffer.from('test')
      const result = await budgetImportExport.importXeroBudgetExport(buffer)

      expect(result.success).toBe(true)
      expect(result.imported).toBeGreaterThan(0)
    })

    it('should parse various Xero account formats', async () => {
      const importer = new BudgetImportExport()
      
      // Test various account formats
      const testCases = [
        { input: '200 - Sales', expected: { code: '200', name: 'Sales' } },
        { input: '400 Cost of Sales', expected: { code: '400', name: 'Cost of Sales' } },
        { input: '820 – VAT Control', expected: { code: '820', name: 'VAT Control' } }, // em dash
      ]

      testCases.forEach(({ input, expected }) => {
        const result = (importer as any).parseXeroAccountInfo(input)
        expect(result).toEqual(expected)
      })
    })

    it('should parse various month header formats', async () => {
      const importer = new BudgetImportExport()
      
      const testCases = [
        { input: 'Jan-24', expected: '2024-01' },
        { input: 'Feb 2024', expected: '2024-02' },
        { input: '03/2024', expected: '2024-03' },
      ]

      testCases.forEach(({ input, expected }) => {
        const result = (importer as any).parseXeroMonthHeader(input)
        expect(result).toBe(expected)
      })
    })

    it('should determine category from account code', async () => {
      const importer = new BudgetImportExport()
      
      const testCases = [
        { code: '200', expected: 'REVENUE' },
        { code: '250', expected: 'REVENUE' },
        { code: '300', expected: 'EXPENSE' },
        { code: '400', expected: 'EXPENSE' },
        { code: '820', expected: 'TAX' },
        { code: '100', expected: 'EXPENSE' }, // Default
      ]

      testCases.forEach(({ code, expected }) => {
        const result = (importer as any).determineCategory(code)
        expect(result).toBe(expected)
      })
    })
  })

  describe('generateBudgetTemplate', () => {
    it('should generate a budget template with GL accounts', async () => {
      const mockAccounts = [
        { code: '200', name: 'Sales', type: 'REVENUE' },
        { code: '400', name: 'Cost of Sales', type: 'EXPENSE' },
        { code: '500', name: 'Operating Expenses', type: 'EXPENSE' },
      ]

      vi.mocked(prisma.gLAccount.findMany).mockResolvedValue(mockAccounts as any)

      const buffer = await budgetImportExport.generateBudgetTemplate()

      expect(prisma.gLAccount.findMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          OR: [
            { type: 'REVENUE' },
            { type: 'EXPENSE' },
          ],
        },
        orderBy: { code: 'asc' },
      })

      // Should create 12 months x 3 accounts = 36 rows
      expect(XLSX.utils.json_to_sheet).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            'Account Code': '200',
            'Account Name': 'Sales',
            'Category': 'REVENUE',
          }),
        ])
      )

      // Should create instructions sheet
      expect(XLSX.utils.aoa_to_sheet).toHaveBeenCalled()
      expect(XLSX.utils.book_append_sheet).toHaveBeenCalledTimes(2) // Instructions + Template

      expect(buffer).toBeInstanceOf(Buffer)
    })

    it('should generate 12 months of template data', async () => {
      vi.mocked(prisma.gLAccount.findMany).mockResolvedValue([
        { code: '200', name: 'Sales', type: 'REVENUE' },
      ] as any)

      await budgetImportExport.generateBudgetTemplate()

      const callArgs = vi.mocked(XLSX.utils.json_to_sheet).mock.calls[0][0] as any[]
      
      // Should have 12 months
      expect(callArgs).toHaveLength(12)
      
      // Check month progression
      const months = callArgs.map(row => row.Month)
      const uniqueMonths = new Set(months)
      expect(uniqueMonths.size).toBe(12)
    })
  })

  describe('error handling', () => {
    it('should handle file parsing errors gracefully', async () => {
      vi.mocked(XLSX.read).mockImplementation(() => {
        throw new Error('Invalid file format')
      })

      const buffer = Buffer.from('invalid')
      const result = await budgetImportExport.importBudgets(buffer, 'test.xlsx')

      expect(result.success).toBe(false)
      expect(result.imported).toBe(0)
      expect(result.errors[0]).toContain('File parsing error')
    })

    it('should continue importing valid rows despite errors', async () => {
      const mixedData = [
        {
          'Account Code': '400',
          'Account Name': 'Valid Account',
          'Category': 'EXPENSE',
          'Month': '2024-01',
          'Budgeted Amount': 1000,
        },
        {
          'Account Code': '', // Invalid - missing code
          'Account Name': 'Invalid Account',
          'Category': 'EXPENSE',
          'Month': '2024-01',
          'Budgeted Amount': 2000,
        },
        {
          'Account Code': '500',
          'Account Name': 'Another Valid',
          'Category': 'EXPENSE',
          'Month': '2024-01',
          'Budgeted Amount': 3000,
        },
      ]

      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as any)

      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue(mixedData)
      vi.mocked(prisma.cashFlowBudget.upsert).mockResolvedValue({} as any)

      const buffer = Buffer.from('test')
      const result = await budgetImportExport.importBudgets(buffer, 'test.xlsx')

      expect(result.success).toBe(false) // Has errors
      expect(result.imported).toBe(2) // But still imported 2 valid rows
      expect(result.errors).toHaveLength(1) // Only 1 error
    })
  })
})