import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';

export async function GET(request: NextRequest) {
  try {
    console.log('Checking Xero status...');
    const xero = await getXeroClient();
    
    if (!xero) {
      console.log('No Xero client available - not connected');
      return NextResponse.json({
        connected: false,
        organization: null
      });
    }
    
    console.log('Xero client obtained, checking tenants...');
    
    // Get organization info
    try {
      await xero.updateTenants();
      const activeTenant = xero.tenants[0];
      
      if (!activeTenant) {
        return NextResponse.json({
          connected: false,
          organization: null
        });
      }
      
      return NextResponse.json({
        connected: true,
        organization: {
          tenantId: activeTenant.tenantId,
          tenantName: activeTenant.tenantName,
          tenantType: activeTenant.tenantType
        }
      });
    } catch (error) {
      console.error('Error fetching tenant info:', error);
      return NextResponse.json({
        connected: false,
        organization: null
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