import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
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
        return sum + (tx.type === 'RECEIVE' ? tx.amount : -Math.abs(tx.amount))
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

    // Return balance sheet data
    return NextResponse.json({
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
    })
  } catch (error) {
    console.error('Balance sheet error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch balance sheet' },
      { status: 500 }
    )
  }
}