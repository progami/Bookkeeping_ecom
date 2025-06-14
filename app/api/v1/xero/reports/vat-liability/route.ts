import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get recent transactions to calculate VAT from database
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3); // Last 3 months

    // Fetch transactions from database
    const transactions = await prisma.bankTransaction.findMany({
      where: {
        status: { not: 'DELETED' },
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        type: true,
        amount: true,
        lineItems: true,
        taxType: true
      }
    });

    let vatOnSales = 0;
    let vatOnPurchases = 0;

    // Calculate VAT from transactions
    transactions.forEach(tx => {
      // Parse line items if they exist
      let taxAmount = 0;
      
      if (tx.lineItems) {
        try {
          const lineItems = JSON.parse(tx.lineItems);
          if (Array.isArray(lineItems)) {
            // Calculate tax from line items
            lineItems.forEach((item: any) => {
              if (item.taxAmount) {
                taxAmount += parseFloat(item.taxAmount) || 0;
              } else if (item.unitAmount && item.quantity && item.taxType) {
                // Estimate tax based on tax type
                const lineTotal = item.unitAmount * item.quantity;
                // Assume standard UK VAT rate of 20% for taxable items
                if (item.taxType !== 'NONE' && item.taxType !== 'EXEMPTOUTPUT') {
                  taxAmount += lineTotal * 0.2; // 20% VAT
                }
              }
            });
          }
        } catch (e) {
          // If line items parsing fails, estimate from transaction amount
          if (tx.taxType && tx.taxType !== 'NONE') {
            // Estimate 20% VAT on the transaction amount
            taxAmount = tx.amount * (0.2 / 1.2); // Extract VAT from VAT-inclusive amount
          }
        }
      } else if (tx.taxType && tx.taxType !== 'NONE') {
        // No line items, estimate from transaction
        taxAmount = tx.amount * (0.2 / 1.2);
      }

      // Accumulate VAT based on transaction type
      if (tx.type === 'RECEIVE') {
        vatOnSales += taxAmount;
      } else if (tx.type === 'SPEND') {
        vatOnPurchases += taxAmount;
      }
    });

    const netVat = vatOnSales - vatOnPurchases;

    // Also check if we have any tax obligations stored
    const vatObligations = await prisma.taxObligation.findMany({
      where: {
        type: 'VAT',
        status: 'PENDING',
        dueDate: {
          gte: new Date()
        }
      },
      orderBy: {
        dueDate: 'asc'
      }
    });

    // Use the next VAT obligation amount if available
    const upcomingVatPayment = vatObligations[0]?.amount || 0;

    return NextResponse.json({
      currentLiability: Math.abs(netVat),
      vatCollected: vatOnSales,
      vatPaid: vatOnPurchases,
      netAmount: netVat,
      upcomingPayment: upcomingVatPayment,
      nextPaymentDue: vatObligations[0]?.dueDate || null,
      reportDate: new Date().toISOString(),
      reportPeriod: 'Last 3 months',
      currency: 'GBP',
      calculatedFromTransactions: true
    });

  } catch (error: any) {
    console.error('Error calculating VAT liability:', error);
    return NextResponse.json(
      { 
        error: 'Failed to calculate VAT liability',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}