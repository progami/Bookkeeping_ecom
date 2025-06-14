import { NextResponse } from 'next/server'
import { getXeroClientWithTenant } from '@/lib/xero-client'

export async function GET() {
  try {
    const xeroData = await getXeroClientWithTenant()
    
    if (!xeroData || !xeroData.client || !xeroData.tenantId) {
      return NextResponse.json(
        { error: 'Xero not connected' },
        { status: 401 }
      )
    }

    const { client, tenantId } = xeroData

    // Get balance sheet report from Xero
    const response = await client.accountingApi.getReportBalanceSheet(
      tenantId,
      undefined, // date - defaults to today
      undefined, // periods
      undefined, // timeframe
      undefined, // trackingOptionID1
      undefined, // trackingOptionID2
      undefined, // standardLayout
      undefined  // paymentsOnly
    )

    const report = response.body.reports?.[0]
    
    if (!report || !report.rows) {
      return NextResponse.json({
        currentAssets: 0,
        currentLiabilities: 0,
        totalAssets: 0,
        totalLiabilities: 0,
        netAssets: 0,
        equity: 0,
        accountsReceivable: 0,
        accountsPayable: 0,
        inventory: 0,
        cash: 0
      })
    }

    // Parse the balance sheet report
    let balanceSheet = {
      currentAssets: 0,
      currentLiabilities: 0,
      totalAssets: 0,
      totalLiabilities: 0,
      netAssets: 0,
      equity: 0,
      accountsReceivable: 0,
      accountsPayable: 0,
      inventory: 0,
      cash: 0
    }

    // Extract values from the report structure
    report.rows.forEach(section => {
      if (section.rowType === 'Section') {
        const sectionTitle = section.title?.toLowerCase() || ''
        
        if (sectionTitle.includes('asset')) {
          section.rows?.forEach(row => {
            if (row.rowType === 'Row' && row.cells) {
              const accountName = row.cells[0]?.value?.toLowerCase() || ''
              const value = parseFloat(row.cells[1]?.value || '0')
              
              if (accountName.includes('accounts receivable') || accountName.includes('debtors')) {
                balanceSheet.accountsReceivable = value
              } else if (accountName.includes('inventory') || accountName.includes('stock')) {
                balanceSheet.inventory = value
              } else if (accountName.includes('bank') || accountName.includes('cash')) {
                balanceSheet.cash += value
              }
              
              if (sectionTitle.includes('current')) {
                balanceSheet.currentAssets += value
              }
              balanceSheet.totalAssets += value
            } else if (row.rowType === 'SummaryRow' && row.cells) {
              const value = parseFloat(row.cells[1]?.value || '0')
              if (sectionTitle.includes('current') && sectionTitle.includes('asset')) {
                balanceSheet.currentAssets = value
              }
            }
          })
        } else if (sectionTitle.includes('liabilit')) {
          section.rows?.forEach(row => {
            if (row.rowType === 'Row' && row.cells) {
              const accountName = row.cells[0]?.value?.toLowerCase() || ''
              const value = parseFloat(row.cells[1]?.value || '0')
              
              if (accountName.includes('accounts payable') || accountName.includes('creditors')) {
                balanceSheet.accountsPayable = value
              }
              
              if (sectionTitle.includes('current')) {
                balanceSheet.currentLiabilities += value
              }
              balanceSheet.totalLiabilities += value
            } else if (row.rowType === 'SummaryRow' && row.cells) {
              const value = parseFloat(row.cells[1]?.value || '0')
              if (sectionTitle.includes('current') && sectionTitle.includes('liabilit')) {
                balanceSheet.currentLiabilities = value
              }
            }
          })
        } else if (sectionTitle.includes('equity')) {
          section.rows?.forEach(row => {
            if (row.rowType === 'Row' && row.cells) {
              const value = parseFloat(row.cells[1]?.value || '0')
              balanceSheet.equity += value
            }
          })
        }
      }
    })

    balanceSheet.netAssets = balanceSheet.totalAssets - balanceSheet.totalLiabilities

    return NextResponse.json(balanceSheet)
  } catch (error) {
    console.error('Balance sheet error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch balance sheet' },
      { status: 500 }
    )
  }
}