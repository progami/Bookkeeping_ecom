import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Get all GL accounts from database
    const glAccounts = await prisma.gLAccount.findMany({
      where: { status: 'ACTIVE' },
      select: { code: true, name: true },
      orderBy: { code: 'asc' }
    });
    
    // Build the map
    const glAccountMap = new Map<string, string>();
    glAccounts.forEach(acc => {
      glAccountMap.set(acc.code, acc.name);
    });
    
    // Test specific codes
    const testCodes = ['453', '469', '477'];
    const testResults = testCodes.map(code => ({
      code,
      name: glAccountMap.get(code),
      inMap: glAccountMap.has(code)
    }));
    
    return NextResponse.json({
      totalAccounts: glAccounts.length,
      mapSize: glAccountMap.size,
      testResults,
      first5Accounts: glAccounts.slice(0, 5)
    });
    
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({
      error: 'Failed to debug GL map',
      message: error.message
    }, { status: 500 });
  }
}