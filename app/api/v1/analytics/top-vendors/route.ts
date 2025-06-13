import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
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
      case '365d':
        startDate.setDate(now.getDate() - 365);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Get all SPEND transactions grouped by vendor
    const transactions = await prisma.bankTransaction.findMany({
      where: {
        type: 'SPEND',
        date: {
          gte: startDate,
          lte: now
        },
        contactName: {
          not: null
        }
      },
      select: {
        contactName: true,
        amount: true,
        date: true
      }
    });

    // Group by vendor and calculate totals
    const vendorTotals = transactions.reduce((acc: Record<string, {
      name: string;
      totalAmount: number;
      transactionCount: number;
      lastTransaction: Date;
    }>, transaction) => {
      const vendor = transaction.contactName!;
      
      if (!acc[vendor]) {
        acc[vendor] = {
          name: vendor,
          totalAmount: 0,
          transactionCount: 0,
          lastTransaction: transaction.date
        };
      }
      
      acc[vendor].totalAmount += Math.abs(transaction.amount);
      acc[vendor].transactionCount += 1;
      
      if (transaction.date > acc[vendor].lastTransaction) {
        acc[vendor].lastTransaction = transaction.date;
      }
      
      return acc;
    }, {});

    // Convert to array and sort by total amount
    const sortedVendors = Object.values(vendorTotals)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 5);

    // Calculate total spend for percentage
    const totalSpend = Object.values(vendorTotals)
      .reduce((sum, vendor) => sum + vendor.totalAmount, 0);

    // Add percentage and format response
    const topVendors = sortedVendors.map((vendor, index) => ({
      rank: index + 1,
      name: vendor.name,
      totalAmount: vendor.totalAmount,
      transactionCount: vendor.transactionCount,
      lastTransaction: vendor.lastTransaction,
      percentageOfTotal: totalSpend > 0 ? (vendor.totalAmount / totalSpend) * 100 : 0,
      averageTransactionAmount: vendor.totalAmount / vendor.transactionCount
    }));

    // Get period comparison data
    let previousStartDate = new Date();
    let previousEndDate = new Date(startDate);
    
    switch (period) {
      case '7d':
        previousStartDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        previousStartDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        previousStartDate.setDate(startDate.getDate() - 90);
        break;
      case '365d':
        previousStartDate.setDate(startDate.getDate() - 365);
        break;
    }

    // Get previous period data for comparison
    const previousTransactions = await prisma.bankTransaction.findMany({
      where: {
        type: 'SPEND',
        date: {
          gte: previousStartDate,
          lt: previousEndDate
        },
        contactName: {
          not: null
        }
      },
      select: {
        contactName: true,
        amount: true
      }
    });

    const previousVendorTotals = previousTransactions.reduce((acc: Record<string, number>, transaction) => {
      const vendor = transaction.contactName!;
      acc[vendor] = (acc[vendor] || 0) + Math.abs(transaction.amount);
      return acc;
    }, {});

    // Add growth rate to top vendors
    const vendorsWithGrowth = topVendors.map(vendor => {
      const previousAmount = previousVendorTotals[vendor.name] || 0;
      const growth = previousAmount > 0 
        ? ((vendor.totalAmount - previousAmount) / previousAmount) * 100 
        : vendor.totalAmount > 0 ? 100 : 0;
      
      return {
        ...vendor,
        growth,
        previousAmount
      };
    });

    return NextResponse.json({
      success: true,
      period,
      startDate,
      endDate: now,
      totalSpend,
      vendorCount: Object.keys(vendorTotals).length,
      topVendors: vendorsWithGrowth,
      summary: {
        topVendorSpend: sortedVendors.reduce((sum, v) => sum + v.totalAmount, 0),
        topVendorPercentage: totalSpend > 0 
          ? (sortedVendors.reduce((sum, v) => sum + v.totalAmount, 0) / totalSpend) * 100 
          : 0
      }
    });

  } catch (error: any) {
    console.error('Error fetching top vendors:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch top vendors',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}