import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'
import { withValidation } from '@/lib/validation/middleware'
import { reportQuerySchema } from '@/lib/validation/schemas'
import { auditLogger, AuditAction, AuditResource } from '@/lib/audit-logger'

export const GET = withValidation(
  { querySchema: reportQuerySchema },
  async (request, { query }) => {
    const startTime = Date.now();
    try {
    // Set cache headers for better performance
    const responseHeaders = {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      'CDN-Cache-Control': 'max-age=600',
    };
    // Calculate balance sheet from database
    
    // Get all bank accounts with their latest balances
    const bankAccounts = await prisma.bankAccount.findMany({
      include: {
        transactions: {
          where: {
            status: { not: 'DELETED' }
          }
        }
      }
    })
    
    // Calculate current cash balance from bank transactions
    let totalCash = 0
    for (const account of bankAccounts) {
      const balance = account.transactions.reduce((sum, tx) => {
        // RECEIVE is positive, SPEND is negative
        const amount = tx.amount ? (typeof tx.amount === 'number' ? tx.amount : tx.amount.toNumber()) : 0
        return sum + (tx.type === 'RECEIVE' ? amount : -Math.abs(amount))
      }, 0)
      totalCash += balance
    }
    
    // Get accounts receivable (unpaid invoices - would need invoice sync)
    const accountsReceivable = 0 // Placeholder until we sync invoices
    
    // Get accounts payable (unpaid bills - would need bill sync)  
    const accountsPayable = 0 // Placeholder until we sync bills
    
    // Calculate basic balance sheet
    const currentAssets = totalCash + accountsReceivable
    const currentLiabilities = accountsPayable
    const totalAssets = currentAssets
    const totalLiabilities = currentLiabilities
    const netAssets = totalAssets - totalLiabilities
    const equity = netAssets

    const balanceSheetData = {
      currentAssets,
      currentLiabilities,
      totalAssets,
      totalLiabilities,
      netAssets,
      equity,
      accountsReceivable,
      accountsPayable,
      inventory: 0, // Not tracked in bank transactions
      cash: totalCash
    };

    // Log successful balance sheet generation
    await auditLogger.logSuccess(
      AuditAction.REPORT_GENERATE,
      AuditResource.BALANCE_SHEET,
      {
        metadata: {
          queryParams: query,
          duration: Date.now() - startTime
        }
      }
    );

    // Return balance sheet data with cache headers
    return NextResponse.json(balanceSheetData, {
      headers: responseHeaders
    })
  } catch (error) {
    console.error('Balance sheet error:', error)
    
    // Log failure
    await auditLogger.logFailure(
      AuditAction.REPORT_GENERATE,
      AuditResource.BALANCE_SHEET,
      error as Error,
      {
        metadata: {
          queryParams: query,
          duration: Date.now() - startTime
        }
      }
    );
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch balance sheet' },
      { status: 500 }
    )
  }
  }
)