import { NextRequest, NextResponse } from 'next/server';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { CashFlowDataSync } from '@/lib/cashflow-sync';
import { UKTaxCalculator } from '@/lib/uk-tax-calculator';

export async function POST(request: NextRequest) {
  try {
    const { syncType = 'DELTA' } = await request.json();

    // Get Xero client
    const xeroData = await getXeroClientWithTenant();

    if (!xeroData || !xeroData.client || !xeroData.tenantId) {
      return NextResponse.json(
        { error: 'Xero not connected' },
        { status: 401 }
      );
    }

    // Create sync instance
    const sync = new CashFlowDataSync(xeroData.client, xeroData.tenantId);

    // Perform sync based on type
    let result;
    if (syncType === 'FULL_RECONCILIATION') {
      result = await sync.performFullReconciliation();
    } else {
      result = await sync.performDailySync();
    }

    // Calculate and store tax obligations
    const taxCalculator = new UKTaxCalculator(xeroData.client, xeroData.tenantId);
    const taxObligations = await taxCalculator.calculateUpcomingTaxes(365);
    await taxCalculator.storeTaxObligations(taxObligations);

    return NextResponse.json({
      success: result.success,
      syncType,
      summary: {
        itemsSynced: result.itemsSynced,
        itemsCreated: result.itemsCreated,
        itemsUpdated: result.itemsUpdated,
        itemsDeleted: result.itemsDeleted,
        taxObligationsCreated: taxObligations.length,
      },
    });
  } catch (error) {
    console.error('Cash flow sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}