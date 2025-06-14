import { NextRequest, NextResponse } from 'next/server';
import { getXeroClientWithTenant } from '@/lib/xero-client';
import { executeXeroAPICall } from '@/lib/xero-client-with-rate-limit';
import { cacheManager, XeroCache } from '@/lib/xero-cache';

export async function GET(request: NextRequest) {
  try {
    const xeroData = await getXeroClientWithTenant()
    
    if (!xeroData || !xeroData.client || !xeroData.tenantId) {
      return NextResponse.json(
        { error: 'Xero not connected' },
        { status: 401 }
      )
    }

    const { client, tenantId } = xeroData
    const cache = cacheManager.getCache(tenantId);
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '30d';
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'year':
        startDate.setDate(now.getDate() - 365);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Try to get from cache first
    const cacheKey = XeroCache.CACHE_TYPES.VENDORS.key;
    const cacheParams = { period, startDate: startDate.toISOString() };
    
    const cachedResponse = await cache.get(
      cacheKey,
      cacheParams,
      async () => {
        // Get bills (purchases/expenses) from Xero for the period with rate limiting
        return await executeXeroAPICall(
          tenantId,
          async (client) => client.accountingApi.getInvoices(
            tenantId,
            startDate,
            undefined, // where
            undefined, // order
            undefined, // IDs
            undefined, // InvoiceNumbers
            undefined, // ContactIDs
            undefined, // Statuses
            100, // page size
            undefined, // page
            undefined, // includeArchived
            undefined, // createdByMyApp
            undefined // unitdp
          )
        );
      },
      { ttl: XeroCache.CACHE_TYPES.VENDORS.ttl }
    );

    const billsResponse = cachedResponse || await executeXeroAPICall(
      tenantId,
      async (client) => client.accountingApi.getInvoices(
        tenantId,
        startDate,
        undefined, // where
        undefined, // order
        undefined, // IDs
        undefined, // InvoiceNumbers
        undefined, // ContactIDs
        undefined, // Statuses
        100, // page size
        undefined, // page
        undefined, // includeArchived
        undefined, // createdByMyApp
        undefined // unitdp
      )
    );

    // Filter for bills (type ACCPAY) and group by vendor
    const vendorSpending: Record<string, {
      contactId: string;
      name: string;
      totalSpend: number;
      transactionCount: number;
      lastTransaction: Date;
    }> = {};

    if (billsResponse.body?.invoices) {
      billsResponse.body.invoices.forEach((invoice: any) => {
        // Only process bills (ACCPAY type) that are not draft or deleted
        if (invoice.type === 'ACCPAY' && 
            invoice.status !== 'DRAFT' && 
            invoice.status !== 'DELETED' &&
            invoice.contact?.contactID) {
          
          const contactId = invoice.contact.contactID;
          const contactName = invoice.contact.name || 'Unknown Vendor';
          const amount = invoice.total || 0;
          const date = new Date(invoice.date || invoice.dateString);
          
          if (!vendorSpending[contactId]) {
            vendorSpending[contactId] = {
              contactId,
              name: contactName,
              totalSpend: 0,
              transactionCount: 0,
              lastTransaction: date
            };
          }
          
          vendorSpending[contactId].totalSpend += amount;
          vendorSpending[contactId].transactionCount += 1;
          
          if (date > vendorSpending[contactId].lastTransaction) {
            vendorSpending[contactId].lastTransaction = date;
          }
        }
      });
    }

    // Convert to array and sort by total spend
    const sortedVendors = Object.values(vendorSpending)
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 5);

    // Calculate total spend
    const totalSpend = Object.values(vendorSpending)
      .reduce((sum, vendor) => sum + vendor.totalSpend, 0);

    // Format response with proper vendor data
    const vendors = sortedVendors.map((vendor, index) => ({
      rank: index + 1,
      contactId: vendor.contactId,
      name: vendor.name,
      totalSpend: vendor.totalSpend,
      transactionCount: vendor.transactionCount,
      lastTransaction: vendor.lastTransaction.toISOString(),
      percentageOfTotal: totalSpend > 0 ? (vendor.totalSpend / totalSpend) * 100 : 0,
      averageTransactionAmount: vendor.totalSpend / vendor.transactionCount
    }));

    // Calculate growth for each vendor (would need historical data)
    const topVendors = sortedVendors.map((vendor, index) => ({
      rank: index + 1,
      name: vendor.name,
      totalAmount: vendor.totalSpend,
      transactionCount: vendor.transactionCount,
      lastTransaction: vendor.lastTransaction.toISOString(),
      percentageOfTotal: totalSpend > 0 ? parseFloat(((vendor.totalSpend / totalSpend) * 100).toFixed(1)) : 0,
      averageTransactionAmount: vendor.totalSpend / vendor.transactionCount,
      growth: 0 // Would need previous period data to calculate
    }));

    return NextResponse.json({
      success: true,
      topVendors,
      vendors, // Keep for backward compatibility
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      totalSpend,
      vendorCount: Object.keys(vendorSpending).length,
      summary: {
        topVendorSpend: sortedVendors.reduce((sum, v) => sum + v.totalSpend, 0),
        topVendorPercentage: totalSpend > 0 
          ? (sortedVendors.reduce((sum, v) => sum + v.totalSpend, 0) / totalSpend) * 100 
          : 0,
        currency: 'GBP'
      }
    });

  } catch (error: any) {
    console.error('Error fetching top vendors from Xero:', error);
    
    // Check if it's a rate limit error
    if (error.response?.status === 429 || error.message?.includes('Daily API limit')) {
      return NextResponse.json({ 
        error: 'Rate limit exceeded',
        message: error.message,
        retryAfter: error.response?.headers?.['retry-after'] || 60
      }, { status: 429 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch top vendors',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}