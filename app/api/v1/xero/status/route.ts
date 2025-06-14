import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getXeroClient } from '@/lib/xero-client';

// Force dynamic rendering to ensure cookies work properly
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    console.log('[XeroStatus] ========== STATUS CHECK START ==========');
    console.log('[XeroStatus] Request headers:', {
      cookie: request.headers.get('cookie'),
      host: request.headers.get('host'),
      referer: request.headers.get('referer')
    });
    
    // Try to get Xero client to check if we're connected
    const xero = await getXeroClient();
    console.log('[XeroStatus] Xero client retrieved:', !!xero);
    
    // Check last sync status from database
    const lastSync = await prisma.syncLog.findFirst({
      where: {
        status: 'success'
      },
      orderBy: {
        completedAt: 'desc'
      },
      select: {
        completedAt: true
      }
    });
    console.log('[XeroStatus] Last sync found:', !!lastSync);

    if (!xero) {
      console.log('[XeroStatus] No Xero client - returning not connected');
      console.log('[XeroStatus] ========== STATUS CHECK END (NOT CONNECTED) ==========');
      return NextResponse.json({
        connected: false,
        organization: null,
        lastSync: lastSync?.completedAt || null
      });
    }
    
    console.log('Xero client obtained, checking tenants...');
    
    // Get organization info from tenants
    try {
      if (!xero.tenants || xero.tenants.length === 0) {
        // Try to update tenants
        await xero.updateTenants();
      }
      
      const activeTenant = xero.tenants[0];
      
      if (!activeTenant) {
        return NextResponse.json({
          connected: false,
          organization: null,
          lastSync: lastSync?.completedAt || null
        });
      }
      
      return NextResponse.json({
        connected: true,
        organization: {
          tenantId: activeTenant.tenantId,
          tenantName: activeTenant.tenantName,
          tenantType: activeTenant.tenantType
        },
        lastSync: lastSync?.completedAt || null
      });
    } catch (error) {
      console.error('Error fetching tenant info:', error);
      // Even if tenant fetch fails, we might still be connected
      return NextResponse.json({
        connected: true,
        organization: {
          tenantId: 'unknown',
          tenantName: 'Connected Organization',
          tenantType: 'ORGANISATION'
        },
        lastSync: lastSync?.completedAt || null
      });
    }
  } catch (error) {
    console.error('Error checking Xero status:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}