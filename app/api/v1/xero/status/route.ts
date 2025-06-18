import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getXeroClient } from '@/lib/xero-client';
import { Logger } from '@/lib/logger';

const logger = new Logger({ component: 'xero-status' });

// Force dynamic rendering to ensure cookies work properly
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    logger.debug('Starting Xero status check', {
      headers: {
        hasCookie: !!request.headers.get('cookie'),
        host: request.headers.get('host'),
        referer: request.headers.get('referer')
      }
    });
    
    // Try to get Xero client to check if we're connected
    const xero = await getXeroClient();
    logger.debug('Xero client retrieval result', {
      hasClient: !!xero
    });
    
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
    logger.debug('Last sync status', {
      hasLastSync: !!lastSync,
      lastSyncDate: lastSync?.completedAt
    });

    if (!xero) {
      logger.info('No Xero client available - user not connected');
      return NextResponse.json({
        connected: false,
        organization: null,
        lastSync: lastSync?.completedAt || null
      });
    }
    
    logger.debug('Xero client obtained, checking tenants');
    
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
      logger.error('Error fetching tenant info', error);
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
    logger.error('Error checking Xero status', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}