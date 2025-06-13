import { NextResponse } from 'next/server';
import { getXeroClientWithTenant } from '@/lib/xero-client';

export async function GET() {
  try {
    console.log('[Trial Balance YTD] Starting fetch...');
    
    const xeroData = await getXeroClientWithTenant();
    if (!xeroData) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }
    
    const { client: xero, tenantId } = xeroData;
    
    // Get current date for YTD
    const toDate = new Date().toISOString().split('T')[0];
    
    // Fetch Trial Balance report - this gives us YTD balances
    console.log('[Trial Balance YTD] Fetching Trial Balance report...');
    const trialBalanceResponse = await xero.accountingApi.getReportTrialBalance(
      tenantId,
      toDate
    );
    
    const report = trialBalanceResponse.body?.reports?.[0];
    if (!report || !report.rows) {
      console.log('[Trial Balance YTD] No report data found');
      return NextResponse.json({ accounts: [] });
    }
    
    // Parse the Trial Balance report
    const accounts: any[] = [];
    const sectionRows = report.rows.filter((row: any) => row.rowType === 'Section');
    
    for (const section of sectionRows) {
      if (section.rows) {
        for (const accountRow of section.rows) {
          if (accountRow.cells && accountRow.cells.length >= 4) {
            const accountName = accountRow.cells[0]?.value || '';
            const ytdDebit = parseFloat(accountRow.cells[1]?.value || '0');
            const ytdCredit = parseFloat(accountRow.cells[2]?.value || '0');
            const ytdAmount = parseFloat(accountRow.cells[3]?.value || '0');
            
            if (accountName && (ytdDebit !== 0 || ytdCredit !== 0 || ytdAmount !== 0)) {
              // Extract code from account name if it's in format "Name (CODE)"
              let code = '';
              let cleanName = accountName;
              const codeMatch = accountName.match(/\(([^)]+)\)$/);
              if (codeMatch) {
                code = codeMatch[1];
                cleanName = accountName.replace(/ \([^)]+\)$/, '').trim();
              }
              
              accounts.push({
                accountName,
                accountCode: code,
                cleanAccountName: cleanName,
                ytdDebit,
                ytdCredit,
                ytdAmount,
                hasActivity: true
              });
            }
          }
        }
      }
    }
    
    console.log(`[Trial Balance YTD] Found ${accounts.length} accounts with YTD activity`);
    
    return NextResponse.json({
      accounts,
      totalAccounts: accounts.length,
      reportDate: toDate
    });
    
  } catch (error: any) {
    console.error('[Trial Balance YTD] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch YTD data',
      message: error.message 
    }, { status: 500 });
  }
}