import { NextResponse } from 'next/server';
import { getXeroClientWithTenant } from '@/lib/xero-client';

export async function GET() {
  try {
    console.log('[Trial Balance ALL] Starting fetch...');
    
    const xeroData = await getXeroClientWithTenant();
    if (!xeroData) {
      return NextResponse.json({ error: 'Not connected to Xero' }, { status: 401 });
    }
    
    const { client: xero, tenantId } = xeroData;
    
    // Get current date for YTD
    const toDate = new Date().toISOString().split('T')[0];
    
    // Fetch Trial Balance report - this gives us ALL accounts including those with 0 balance
    console.log('[Trial Balance ALL] Fetching Trial Balance report with all accounts...');
    const trialBalanceResponse = await xero.accountingApi.getReportTrialBalance(
      tenantId,
      toDate
    );
    
    const report = trialBalanceResponse.body?.reports?.[0];
    if (!report || !report.rows) {
      console.log('[Trial Balance ALL] No report data found');
      return NextResponse.json({ accounts: [] });
    }
    
    // Log the raw structure to understand it better
    console.log('[Trial Balance ALL] Report structure:', {
      rowCount: report.rows.length,
      firstRow: report.rows[0]
    });
    
    // Parse the Trial Balance report - include ALL accounts
    const accounts: any[] = [];
    const sectionRows = report.rows.filter((row: any) => row.rowType === 'Section');
    
    for (const section of sectionRows) {
      console.log(`[Trial Balance ALL] Processing section: ${section.title || 'Unnamed'}`);
      
      if (section.rows) {
        for (const accountRow of section.rows) {
          if (accountRow.cells && accountRow.cells.length >= 4) {
            const accountName = accountRow.cells[0]?.value || '';
            const ytdDebit = parseFloat(accountRow.cells[1]?.value || '0');
            const ytdCredit = parseFloat(accountRow.cells[2]?.value || '0');
            const netAmount = parseFloat(accountRow.cells[3]?.value || '0');
            
            // Calculate the actual YTD amount
            // For accounts with debit balance, use ytdDebit
            // For accounts with credit balance, use ytdCredit (as negative)
            // If netAmount is provided and non-zero, use that
            let ytdAmount = 0;
            if (netAmount !== 0) {
              ytdAmount = netAmount;
            } else if (ytdDebit !== 0) {
              ytdAmount = ytdDebit;
            } else if (ytdCredit !== 0) {
              ytdAmount = -ytdCredit; // Credit balances are typically shown as negative
            }
            
            // Include ALL accounts, even with 0 balance
            if (accountName) {
              // Extract code from account name if it's in format "Name (CODE)"
              let code = '';
              let cleanName = accountName;
              const codeMatch = accountName.match(/\(([^)]+)\)$/);
              if (codeMatch) {
                code = codeMatch[1];
                cleanName = accountName.replace(/ \([^)]+\)$/, '').trim();
              }
              
              // Check if this is a system account (VAT, PAYE, etc)
              const isSystemAccount = cleanName.includes('VAT') || 
                                    cleanName.includes('PAYE') || 
                                    cleanName.includes('NIC') ||
                                    cleanName.includes('Corporation Tax') ||
                                    cleanName.includes('HMRC');
              
              accounts.push({
                accountName,
                accountCode: code,
                cleanAccountName: cleanName,
                ytdDebit,
                ytdCredit,
                ytdAmount,
                hasActivity: ytdDebit !== 0 || ytdCredit !== 0 || ytdAmount !== 0,
                isSystemAccount,
                section: section.title || 'Unknown'
              });
              
              // Log system accounts specifically
              if (isSystemAccount || code === '825' || code === '820') {
                console.log(`[Trial Balance ALL] System account found: ${accountName} - Debit: ${ytdDebit}, Credit: ${ytdCredit}, Net: ${netAmount}, Calculated YTD: ${ytdAmount}`);
              }
            }
          }
        }
      }
    }
    
    console.log(`[Trial Balance ALL] Found ${accounts.length} total accounts`);
    console.log(`[Trial Balance ALL] Accounts with activity: ${accounts.filter(a => a.hasActivity).length}`);
    console.log(`[Trial Balance ALL] System accounts: ${accounts.filter(a => a.isSystemAccount).length}`);
    
    // Log VAT accounts specifically if found
    const vatAccounts = accounts.filter(a => 
      a.accountCode === '825' || 
      a.accountCode === '820' || 
      a.cleanAccountName.includes('VAT') ||
      a.accountName.includes('VAT')
    );
    
    if (vatAccounts.length > 0) {
      console.log('[Trial Balance ALL] VAT Accounts found:');
      vatAccounts.forEach(vat => {
        console.log(`  - ${vat.accountName}: YTD Amount = ${vat.ytdAmount}`);
      });
    } else {
      console.log('[Trial Balance ALL] WARNING: No VAT accounts found in Trial Balance!');
    }
    
    return NextResponse.json({
      accounts,
      totalAccounts: accounts.length,
      accountsWithActivity: accounts.filter(a => a.hasActivity).length,
      systemAccounts: accounts.filter(a => a.isSystemAccount),
      reportDate: toDate
    });
    
  } catch (error: any) {
    console.error('[Trial Balance ALL] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch all accounts',
      message: error.message 
    }, { status: 500 });
  }
}