import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';

export async function GET(request: NextRequest) {
  try {
    const xeroClient = await getXeroClient();
    if (!xeroClient) {
      return NextResponse.json(
        { error: 'Xero client not initialized' },
        { status: 503 }
      );
    }

    // Update tenants to get tenant ID
    await xeroClient.updateTenants();
    const tenantId = xeroClient.tenants[0]?.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'No active tenant found' },
        { status: 503 }
      );
    }

    // Get all active suppliers/vendors from Xero
    const response = await xeroClient.accountingApi.getContacts(
      tenantId,
      undefined, // IFModifiedSince
      'IsSupplier==true', // where filter for suppliers only
      'Name ASC', // order by name
      undefined, // IDs
      1, // page
      false, // includeArchived
      undefined, // summaryOnly
      undefined // searchTerm
    );

    const vendors = response.body.contacts?.map(contact => ({
      id: contact.contactID,
      name: contact.name,
      email: contact.emailAddress,
      isSupplier: contact.isSupplier,
      isCustomer: contact.isCustomer,
      taxNumber: contact.taxNumber,
      accountNumber: contact.accountNumber,
      status: contact.contactStatus,
      addresses: contact.addresses,
      phones: contact.phones,
      // Include default expense account if set
      defaultExpenseAccount: contact.defaultCurrency
    })) || [];

    // Cache the response for 5 minutes
    return NextResponse.json(
      {
        success: true,
        vendors,
        count: vendors.length,
        timestamp: new Date().toISOString()
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=300'
        }
      }
    );
  } catch (error: any) {
    console.error('Error fetching vendors from Xero:', error);
    
    // Check if it's an auth error
    if (error.response?.statusCode === 401) {
      return NextResponse.json(
        { error: 'Xero authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch vendors',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}