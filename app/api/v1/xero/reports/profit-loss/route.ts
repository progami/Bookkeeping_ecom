import { NextResponse } from 'next/server'
import { getXeroClientWithTenant } from '@/lib/xero-client'
import { RowType } from 'xero-node'

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

    // Get profit & loss report from Xero
    const response = await client.accountingApi.getReportProfitAndLoss(
      tenantId,
      undefined, // fromDate
      undefined, // toDate
      undefined, // periods
      undefined, // timeframe
      undefined, // trackingCategoryID
      undefined, // trackingCategoryID2
      undefined, // trackingOptionID
      undefined, // trackingOptionID2
      undefined, // standardLayout
      undefined  // paymentsOnly
    )

    const report = response.body.reports?.[0]
    
    if (!report || !report.rows) {
      return NextResponse.json({
        totalRevenue: 0,
        totalExpenses: 0,
        grossProfit: 0,
        netProfit: 0,
        operatingExpenses: 0,
        costOfGoodsSold: 0
      })
    }

    // Parse the P&L report
    let profitLoss = {
      totalRevenue: 0,
      totalExpenses: 0,
      grossProfit: 0,
      netProfit: 0,
      operatingExpenses: 0,
      costOfGoodsSold: 0
    }

    // Extract values from the report structure
    report.rows.forEach(section => {
      if (section.rowType === RowType.Section) {
        const sectionTitle = section.title?.toLowerCase() || ''
        
        if (sectionTitle.includes('income') || sectionTitle.includes('revenue') || sectionTitle.includes('sales')) {
          section.rows?.forEach(row => {
            if (row.rowType === RowType.Row && row.cells) {
              const value = parseFloat(row.cells[1]?.value || '0')
              profitLoss.totalRevenue += value
            } else if (row.rowType === RowType.SummaryRow && row.cells) {
              const value = parseFloat(row.cells[1]?.value || '0')
              if (sectionTitle.includes('total') && (sectionTitle.includes('income') || sectionTitle.includes('revenue'))) {
                profitLoss.totalRevenue = value
              }
            }
          })
        } else if (sectionTitle.includes('cost of goods sold') || sectionTitle.includes('cost of sales')) {
          section.rows?.forEach(row => {
            if (row.rowType === RowType.Row && row.cells) {
              const value = parseFloat(row.cells[1]?.value || '0')
              profitLoss.costOfGoodsSold += value
            } else if (row.rowType === RowType.SummaryRow && row.cells) {
              const value = parseFloat(row.cells[1]?.value || '0')
              profitLoss.costOfGoodsSold = value
            }
          })
        } else if (sectionTitle.includes('expense') || sectionTitle.includes('operating')) {
          section.rows?.forEach(row => {
            if (row.rowType === RowType.Row && row.cells) {
              const value = parseFloat(row.cells[1]?.value || '0')
              profitLoss.operatingExpenses += value
              profitLoss.totalExpenses += value
            } else if (row.rowType === RowType.SummaryRow && row.cells) {
              const value = parseFloat(row.cells[1]?.value || '0')
              if (sectionTitle.includes('operating')) {
                profitLoss.operatingExpenses = value
              }
            }
          })
        } else if (sectionTitle.includes('gross profit')) {
          section.rows?.forEach(row => {
            if (row.rowType === RowType.Row && row.cells) {
              const value = parseFloat(row.cells[1]?.value || '0')
              profitLoss.grossProfit = value
            }
          })
        } else if (sectionTitle.includes('net profit') || sectionTitle.includes('net income')) {
          section.rows?.forEach(row => {
            if (row.rowType === RowType.Row && row.cells) {
              const value = parseFloat(row.cells[1]?.value || '0')
              profitLoss.netProfit = value
            }
          })
        }
      }
    })

    // Calculate totals if not already set
    if (profitLoss.grossProfit === 0) {
      profitLoss.grossProfit = profitLoss.totalRevenue - profitLoss.costOfGoodsSold
    }
    
    profitLoss.totalExpenses = profitLoss.costOfGoodsSold + profitLoss.operatingExpenses
    
    if (profitLoss.netProfit === 0) {
      profitLoss.netProfit = profitLoss.totalRevenue - profitLoss.totalExpenses
    }

    return NextResponse.json(profitLoss)
  } catch (error) {
    console.error('Profit & Loss error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch profit & loss' },
      { status: 500 }
    )
  }
}