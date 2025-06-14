import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '30d';
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    let days = 30;
    switch (period) {
      case '7d':
        days = 7;
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        days = 30;
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        days = 90;
        startDate.setDate(now.getDate() - 90);
        break;
      case 'year':
        days = 365;
        startDate.setDate(now.getDate() - 365);
        break;
      default:
        days = 30;
        startDate.setDate(now.getDate() - 30);
    }

    // Query from database - group bank transactions by vendor
    const transactions = await prisma.bankTransaction.findMany({
      where: {
        date: {
          gte: startDate,
          lte: now
        },
        type: 'SPEND', // Only expenses/payments to vendors
        status: {
          not: 'DELETED'
        },
        contactName: {
          not: null
        }
      }
    });

    // Calculate comparison period for growth
    const compareStartDate = new Date(startDate);
    compareStartDate.setDate(compareStartDate.getDate() - days);
    const compareEndDate = new Date(startDate);
    
    // Get previous period transactions
    const previousTransactions = await prisma.bankTransaction.findMany({
      where: {
        date: { 
          gte: compareStartDate, 
          lt: compareEndDate 
        },
        type: 'SPEND',
        status: { not: 'DELETED' },
        contactName: { not: null }
      }
    });

    // Group transactions by vendor
    const vendorSpending: Record<string, {
      name: string;
      totalAmount: number;
      transactionCount: number;
      lastTransaction: Date;
      previousAmount: number;
    }> = {};

    // Process current period transactions
    transactions.forEach((tx) => {
      const vendorName = tx.contactName || 'Unknown Vendor';
      
      if (!vendorSpending[vendorName]) {
        vendorSpending[vendorName] = {
          name: vendorName,
          totalAmount: 0,
          transactionCount: 0,
          lastTransaction: tx.date,
          previousAmount: 0
        };
      }
      
      // Use absolute value since expenses are negative
      vendorSpending[vendorName].totalAmount += Math.abs(tx.amount);
      vendorSpending[vendorName].transactionCount += 1;
      
      if (tx.date > vendorSpending[vendorName].lastTransaction) {
        vendorSpending[vendorName].lastTransaction = tx.date;
      }
    });

    // Process previous period transactions
    previousTransactions.forEach((tx) => {
      const vendorName = tx.contactName || 'Unknown Vendor';
      
      if (!vendorSpending[vendorName]) {
        vendorSpending[vendorName] = {
          name: vendorName,
          totalAmount: 0,
          transactionCount: 0,
          lastTransaction: new Date(0),
          previousAmount: 0
        };
      }
      
      vendorSpending[vendorName].previousAmount += Math.abs(tx.amount);
    });

    // Convert to array and sort by total spend
    const sortedVendors = Object.values(vendorSpending)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);

    // Calculate total spend
    const totalSpend = Object.values(vendorSpending)
      .reduce((sum, vendor) => sum + vendor.totalAmount, 0);

    // Format response to match test expectations
    const topVendors = sortedVendors.map((vendor, index) => {
      let growth = 0;
      if (vendor.previousAmount > 0) {
        growth = ((vendor.totalAmount - vendor.previousAmount) / vendor.previousAmount) * 100;
      } else if (vendor.totalAmount > 0) {
        growth = 100; // New vendor
      }
      
      return {
        rank: index + 1,
        name: vendor.name,
        totalAmount: vendor.totalAmount,
        transactionCount: vendor.transactionCount,
        lastTransaction: vendor.lastTransaction.toISOString(),
        percentageOfTotal: totalSpend > 0 ? parseFloat(((vendor.totalAmount / totalSpend) * 100).toFixed(1)) : 0,
        averageTransactionAmount: vendor.totalAmount / vendor.transactionCount,
        growth: parseFloat(growth.toFixed(1))
      };
    });

    return NextResponse.json({
      success: true,
      topVendors,
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      totalSpend,
      vendorCount: Object.keys(vendorSpending).length,
      summary: {
        topVendorSpend: sortedVendors.reduce((sum, v) => sum + v.totalAmount, 0),
        topVendorPercentage: totalSpend > 0 
          ? (sortedVendors.reduce((sum, v) => sum + v.totalAmount, 0) / totalSpend) * 100 
          : 0,
        currency: 'GBP'
      }
    });

  } catch (error: any) {
    console.error('Error fetching top vendors from database:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch top vendors',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}