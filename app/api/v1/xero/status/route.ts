import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// Force dynamic rendering to ensure cookies work properly
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Check if we have Xero credentials in cookies
    const cookieStore = cookies();
    const accessToken = cookieStore.get('xero-access-token');
    const tenantId = cookieStore.get('xero-tenant-id');
    const tenantName = cookieStore.get('xero-tenant-name');
    const tenantType = cookieStore.get('xero-tenant-type');
    
    // Check last sync status from database
    const lastSync = await prisma.syncLog.findFirst({
      where: {
        syncType: 'bank_accounts',
        status: 'success'
      },
      orderBy: {
        completedAt: 'desc'
      },
      select: {
        completedAt: true
      }
    });

    if (!accessToken || !tenantId) {
      return NextResponse.json({
        connected: false,
        organization: null,
        lastSync: lastSync?.completedAt || null
      });
    }
    
    return NextResponse.json({
      connected: true,
      organization: {
        tenantId: tenantId.value,
        tenantName: tenantName?.value || 'Unknown Organization',
        tenantType: tenantType?.value || 'ORGANISATION'
      },
      lastSync: lastSync?.completedAt || null
    });
  } catch (error) {
    console.error('Error checking Xero status:', error);
    return NextResponse.json(
      { error: 'Failed to check status' },
      { status: 500 }
    );
  }
}