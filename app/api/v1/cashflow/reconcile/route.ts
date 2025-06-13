import { NextRequest, NextResponse } from 'next/server';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { CashFlowDataSync } from '@/lib/cashflow-sync';

// This endpoint can be called by a cron job weekly
export async function POST(request: NextRequest) {
  try {
    // Verify this is an authorized request (e.g., from cron job with secret)
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.CRON_SECRET;
    
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get Xero client
    const xeroData = await getXeroClientWithTenant();

    if (!xeroData || !xeroData.client || !xeroData.tenantId) {
      return NextResponse.json(
        { error: 'Xero not connected' },
        { status: 401 }
      );
    }

    // Perform full reconciliation
    const sync = new CashFlowDataSync(xeroData.client, xeroData.tenantId);
    const result = await sync.performFullReconciliation();

    // Log the reconciliation
    console.log(`Reconciliation completed: ${result.itemsDeleted} items marked as voided`);

    return NextResponse.json({
      success: result.success,
      summary: {
        itemsSynced: result.itemsSynced,
        itemsCreated: result.itemsCreated,
        itemsUpdated: result.itemsUpdated,
        itemsDeleted: result.itemsDeleted,
      },
      message: `Full reconciliation completed. ${result.itemsDeleted} deleted/voided items found.`,
    });
  } catch (error) {
    console.error('Reconciliation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Reconciliation failed' },
      { status: 500 }
    );
  }
}