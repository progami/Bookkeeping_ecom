import { NextRequest, NextResponse } from 'next/server';
import { requireXeroAuth } from '@/lib/auth-middleware';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { structuredLogger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  return requireXeroAuth(request, async (req) => {
    try {
      const xeroData = await getXeroClientWithTenant();
      
      if (!xeroData) {
        return NextResponse.json(
          { error: 'Failed to get Xero client' },
          { status: 500 }
        );
      }
      
      const { client, tenantId } = xeroData;
      
      // Get organization info
      const orgResponse = await client.accountingApi.getOrganisations(tenantId);
      const organisation = orgResponse.body.organisations?.[0];
      
      // Get current user connections (requires additional scope)
      let userEmail = null;
      try {
        // This requires identity.read scope
        const connections = await client.updateTenants();
        // Extract user info if available
      } catch (error) {
        structuredLogger.debug('Could not fetch user connections', {
          component: 'user-info',
          error
        });
      }
      
      const userInfo = {
        authenticated: true,
        tenant: {
          id: req.xeroUser?.tenantId,
          name: req.xeroUser?.tenantName,
          organisationName: organisation?.name,
          countryCode: organisation?.countryCode,
          timezone: organisation?.timezone,
          currency: organisation?.baseCurrency
        },
        permissions: {
          canSync: true,
          canViewReports: true,
          canExport: true
        },
        lastSync: await getLastSyncInfo()
      };
      
      return NextResponse.json(userInfo);
    } catch (error) {
      structuredLogger.error('Failed to get user info', error, {
        component: 'user-info'
      });
      
      return NextResponse.json(
        { error: 'Failed to get user information' },
        { status: 500 }
      );
    }
  });
}

async function getLastSyncInfo() {
  const { prisma } = await import('@/lib/prisma');
  
  const lastSync = await prisma.syncLog.findFirst({
    where: { status: 'success' },
    orderBy: { completedAt: 'desc' },
    select: {
      completedAt: true,
      recordsCreated: true,
      recordsUpdated: true
    }
  });
  
  return lastSync;
}