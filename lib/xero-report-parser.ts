import { structuredLogger } from '@/lib/logger'
import { Decimal } from '@prisma/client/runtime/library'

/**
 * Configuration-driven Xero report parser
 * Maps Xero report fields to internal data structures
 * Allows updating parsing logic via configuration rather than code changes
 */

interface ReportFieldConfig {
  searchTerms: string[]
  rowType?: string
  section?: string
  cellIndex?: number
  fallbackValue?: string | number
  isNegative?: boolean // For expense values that should be treated as negative
}

interface ReportParserConfig {
  balanceSheet: {
    totalAssets: ReportFieldConfig
    totalLiabilities: ReportFieldConfig
    netAssets: ReportFieldConfig
    cashInBank: ReportFieldConfig
  }
  profitAndLoss: {
    totalIncome: ReportFieldConfig
    totalCostOfSales: ReportFieldConfig
    totalOperatingExpenses: ReportFieldConfig
    netProfit: ReportFieldConfig
  }
}

// Default configuration - can be overridden or loaded from environment/database
const DEFAULT_CONFIG: ReportParserConfig = {
  balanceSheet: {
    totalAssets: {
      searchTerms: ['Total Assets', 'Assets Total', 'Total Asset'],
      rowType: 'SummaryRow',
      cellIndex: 1,
      fallbackValue: 0
    },
    totalLiabilities: {
      searchTerms: ['Total Liabilities', 'Liabilities Total', 'Total Liability'],
      rowType: 'SummaryRow',
      cellIndex: 1,
      fallbackValue: 0
    },
    netAssets: {
      searchTerms: ['Net Assets', 'Total Equity', 'Equity Total'],
      rowType: 'Row',
      cellIndex: 1,
      fallbackValue: 0
    },
    cashInBank: {
      searchTerms: ['Total Bank', 'Bank Total', 'Cash at Bank'],
      section: 'Bank',
      rowType: 'SummaryRow',
      cellIndex: 1,
      fallbackValue: 0
    }
  },
  profitAndLoss: {
    totalIncome: {
      searchTerms: ['Total Income', 'Income Total', 'Total Revenue', 'Revenue Total'],
      section: 'Income',
      rowType: 'SummaryRow',
      cellIndex: 1,
      fallbackValue: 0
    },
    totalCostOfSales: {
      searchTerms: ['Total Cost of Sales', 'Cost of Sales Total', 'COGS Total'],
      section: 'Less Cost of Sales',
      rowType: 'SummaryRow',
      cellIndex: 1,
      fallbackValue: 0,
      isNegative: true
    },
    totalOperatingExpenses: {
      searchTerms: ['Total Operating Expenses', 'Operating Expenses Total', 'Total Expenses'],
      section: 'Less Operating Expenses',
      rowType: 'SummaryRow',
      cellIndex: 1,
      fallbackValue: 0,
      isNegative: true
    },
    netProfit: {
      searchTerms: ['Net Profit', 'Net Income', 'Net Earnings', 'Profit/Loss'],
      rowType: 'Row',
      cellIndex: 1,
      fallbackValue: 0
    }
  }
}

export class XeroReportParser {
  private config: ReportParserConfig

  constructor(config?: Partial<ReportParserConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    }
  }

  /**
   * Parse a Balance Sheet report from Xero
   */
  parseBalanceSheet(report: any): {
    totalAssets: number
    totalLiabilities: number
    netAssets: number
    cashInBank: number
  } {
    try {
      const rows = this.getReportRows(report)
      
      const result = {
        totalAssets: this.findFieldValue(rows, this.config.balanceSheet.totalAssets),
        totalLiabilities: this.findFieldValue(rows, this.config.balanceSheet.totalLiabilities),
        netAssets: this.findFieldValue(rows, this.config.balanceSheet.netAssets),
        cashInBank: this.findFieldValue(rows, this.config.balanceSheet.cashInBank)
      }

      // Calculate net assets if not found directly
      if (result.netAssets === 0 && (result.totalAssets !== 0 || result.totalLiabilities !== 0)) {
        result.netAssets = result.totalAssets - result.totalLiabilities
      }

      structuredLogger.info('Balance sheet parsed', {
        component: 'xero-report-parser',
        result
      })

      return result
    } catch (error) {
      structuredLogger.error('Failed to parse balance sheet', error, {
        component: 'xero-report-parser'
      })
      
      return {
        totalAssets: 0,
        totalLiabilities: 0,
        netAssets: 0,
        cashInBank: 0
      }
    }
  }

  /**
   * Parse a Profit & Loss report from Xero
   */
  parseProfitAndLoss(report: any): {
    totalIncome: number
    totalExpenses: number
    netProfit: number
  } {
    try {
      const rows = this.getReportRows(report)
      
      const totalIncome = this.findFieldValue(rows, this.config.profitAndLoss.totalIncome)
      const totalCostOfSales = Math.abs(this.findFieldValue(rows, this.config.profitAndLoss.totalCostOfSales))
      const totalOperatingExpenses = Math.abs(this.findFieldValue(rows, this.config.profitAndLoss.totalOperatingExpenses))
      const netProfit = this.findFieldValue(rows, this.config.profitAndLoss.netProfit)
      
      const totalExpenses = totalCostOfSales + totalOperatingExpenses
      
      // Calculate net profit if not found directly
      const calculatedNetProfit = netProfit === 0 && (totalIncome !== 0 || totalExpenses !== 0)
        ? totalIncome - totalExpenses
        : netProfit

      const result = {
        totalIncome,
        totalExpenses,
        netProfit: calculatedNetProfit
      }

      structuredLogger.info('Profit & Loss parsed', {
        component: 'xero-report-parser',
        result
      })

      return result
    } catch (error) {
      structuredLogger.error('Failed to parse profit & loss', error, {
        component: 'xero-report-parser'
      })
      
      return {
        totalIncome: 0,
        totalExpenses: 0,
        netProfit: 0
      }
    }
  }

  /**
   * Get report rows from various report structures
   */
  private getReportRows(report: any): any[] {
    // Handle different report structures
    if (report?.body?.reports?.[0]?.rows) {
      return report.body.reports[0].rows
    } else if (report?.reports?.[0]?.rows) {
      return report.reports[0].rows
    } else if (report?.rows) {
      return report.rows
    }
    
    structuredLogger.warn('Unexpected report structure', {
      component: 'xero-report-parser',
      structure: Object.keys(report || {})
    })
    
    return []
  }

  /**
   * Find a field value in report rows based on configuration
   */
  private findFieldValue(rows: any[], config: ReportFieldConfig): number {
    const value = this.searchInRows(rows, config)
    
    if (value !== null) {
      const numericValue = this.parseNumericValue(value)
      return config.isNegative ? -Math.abs(numericValue) : numericValue
    }
    
    return this.parseNumericValue(config.fallbackValue)
  }

  /**
   * Recursively search for a value in report rows
   */
  private searchInRows(rows: any[], config: ReportFieldConfig): string | null {
    for (const row of rows) {
      // Check section match if specified
      if (config.section && row.rowType === 'Section' && row.title !== config.section) {
        continue
      }

      // Check row type match if specified
      if (config.rowType && row.rowType !== config.rowType) {
        // Still search nested rows
        if (row.rows && row.rows.length > 0) {
          const nestedResult = this.searchInRows(row.rows, config)
          if (nestedResult !== null) return nestedResult
        }
        continue
      }

      // Check cells for search terms
      if (row.cells && row.cells.length > 0) {
        const cellValue = this.getCellValue(row.cells[0])
        const cellValueLower = cellValue.toLowerCase()
        
        const isMatch = config.searchTerms.some(term => 
          cellValueLower.includes(term.toLowerCase())
        )
        
        if (isMatch) {
          // Get value from specified cell index
          const valueIndex = config.cellIndex || 1
          if (row.cells[valueIndex]) {
            const value = this.getCellValue(row.cells[valueIndex])
            if (value && value !== '0') {
              return value
            }
          }
        }
      }

      // Recursively search nested rows
      if (row.rows && row.rows.length > 0) {
        const nestedResult = this.searchInRows(row.rows, config)
        if (nestedResult !== null) return nestedResult
      }
    }

    return null
  }

  /**
   * Get cell value handling different cell structures
   */
  private getCellValue(cell: any): string {
    if (typeof cell === 'string') return cell
    if (cell?.value !== undefined) return String(cell.value)
    if (cell?.Value !== undefined) return String(cell.Value)
    return ''
  }

  /**
   * Parse numeric value from various formats
   */
  private parseNumericValue(value: any): number {
    if (typeof value === 'number') return value
    if (!value) return 0
    
    // Remove currency symbols, commas, and parentheses
    const cleaned = String(value)
      .replace(/[£$€¥,]/g, '')
      .replace(/\(([^)]+)\)/, '-$1') // Handle negative values in parentheses
      .trim()
    
    const parsed = parseFloat(cleaned)
    return isNaN(parsed) ? 0 : parsed
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(config: Partial<ReportParserConfig>) {
    this.config = {
      ...this.config,
      ...config
    }
  }
}