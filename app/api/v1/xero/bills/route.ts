import { NextRequest, NextResponse } from 'next/server';
import { getXeroClient } from '@/lib/xero-client';
import { Invoice, LineItem, Contact, LineAmountTypes } from 'xero-node';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      vendorId,
      vendorName,
      invoiceNumber,
      reference,
      billDate,
      dueDate,
      lineItems,
      status = 'DRAFT' // Default to draft
    } = body;

    // Validate required fields
    if (!vendorId && !vendorName) {
      return NextResponse.json(
        { error: 'Either vendorId or vendorName is required' },
        { status: 400 }
      );
    }

    if (!invoiceNumber || !reference || !lineItems || lineItems.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: invoiceNumber, reference, and lineItems' },
        { status: 400 }
      );
    }

    // Prepare contact
    const contact: Contact = vendorId 
      ? { contactID: vendorId }
      : { name: vendorName };

    // Transform line items
    const xeroLineItems: LineItem[] = lineItems.map((item: any) => ({
      description: item.description,
      quantity: item.quantity || 1,
      unitAmount: item.unitAmount || 0,
      accountCode: item.accountCode,
      taxType: item.taxType || 'INPUT2', // Default tax type
      lineAmount: item.lineAmount || (item.quantity || 1) * (item.unitAmount || 0),
      tracking: item.tracking || [] // For tracking categories
    }));

    // Create the bill (invoice of type ACCPAY)
    const bill: Invoice = {
      type: Invoice.TypeEnum.ACCPAY,
      contact,
      invoiceNumber,
      reference,
      date: billDate || new Date().toISOString().split('T')[0],
      dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      lineItems: xeroLineItems,
      status: status === 'AUTHORISED' ? Invoice.StatusEnum.AUTHORISED : Invoice.StatusEnum.DRAFT,
      lineAmountTypes: LineAmountTypes.Exclusive // Tax exclusive
    };

    // Create the invoice in Xero
    const invoices = { invoices: [bill] };
    const response = await xeroClient.accountingApi.createInvoices(
      tenantId,
      invoices
    );

    const createdBill = response.body.invoices?.[0];

    if (!createdBill) {
      throw new Error('Failed to create bill in Xero');
    }

    return NextResponse.json({
      success: true,
      bill: {
        invoiceID: createdBill.invoiceID,
        invoiceNumber: createdBill.invoiceNumber,
        reference: createdBill.reference,
        status: createdBill.status,
        total: createdBill.total,
        subTotal: createdBill.subTotal,
        totalTax: createdBill.totalTax,
        amountDue: createdBill.amountDue,
        url: `https://go.xero.com/AccountsPayable/View.aspx?InvoiceID=${createdBill.invoiceID}`
      },
      message: `Bill ${createdBill.invoiceNumber} created successfully as ${createdBill.status}`
    });

  } catch (error: any) {
    console.error('Error creating bill in Xero:', error);
    
    if (error.response?.statusCode === 401) {
      return NextResponse.json(
        { error: 'Xero authentication required' },
        { status: 401 }
      );
    }

    // Parse Xero validation errors
    if (error.response?.body?.Elements) {
      const validationErrors = error.response.body.Elements[0]?.ValidationErrors || [];
      return NextResponse.json(
        { 
          error: 'Validation error',
          validationErrors: validationErrors.map((e: any) => e.Message),
          details: error.message
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create bill in Xero',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch bills
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const status = searchParams.get('status'); // DRAFT, AUTHORISED, etc.

    // Build where clause
    let where = 'Type=="ACCPAY"'; // Only bills
    if (status) {
      where += ` AND Status=="${status}"`;
    }

    const response = await xeroClient.accountingApi.getInvoices(
      tenantId,
      undefined, // IFModifiedSince
      where,
      'UpdatedDateUTC DESC', // order
      undefined, // IDs
      undefined, // InvoiceNumbers
      undefined, // ContactIDs
      undefined, // Statuses
      page,
      false, // includeArchived
      undefined, // createdByMyApp
      undefined // unitdp
    );

    const bills = response.body.invoices?.map(invoice => ({
      invoiceID: invoice.invoiceID,
      invoiceNumber: invoice.invoiceNumber,
      reference: invoice.reference,
      contactName: invoice.contact?.name,
      date: invoice.date,
      dueDate: invoice.dueDate,
      status: invoice.status,
      total: invoice.total,
      amountDue: invoice.amountDue,
      updatedDateUTC: invoice.updatedDateUTC
    })) || [];

    return NextResponse.json({
      success: true,
      bills,
      count: bills.length,
      page,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error fetching bills from Xero:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch bills',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}