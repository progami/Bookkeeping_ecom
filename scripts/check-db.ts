import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TransactionSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfitLoss: number;
  transactionsByType: {
    RECEIVE: number;
    SPEND: number;
  };
  transactionsByStatus: Record<string, number>;
  reconciledCount: number;
  unreconciledCount: number;
}

async function checkDatabase() {
  console.log('🔍 Database Check Starting...\n');
  console.log('='.repeat(80));

  try {
    // 1. Check Bank Accounts
    console.log('\n📊 BANK ACCOUNTS SUMMARY');
    console.log('-'.repeat(40));
    
    const bankAccounts = await prisma.bankAccount.findMany({
      include: {
        _count: {
          select: { transactions: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    console.log(`Total Bank Accounts: ${bankAccounts.length}`);
    console.log('\nAccount Details:');
    
    let totalBalance = 0;
    bankAccounts.forEach((account, index) => {
      console.log(`\n${index + 1}. ${account.name}`);
      console.log(`   - Xero Account ID: ${account.xeroAccountId}`);
      console.log(`   - Code: ${account.code || 'N/A'}`);
      console.log(`   - Currency: ${account.currencyCode || 'N/A'}`);
      console.log(`   - Balance: $${account.balance.toFixed(2)}`);
      console.log(`   - Last Updated: ${account.balanceLastUpdated ? account.balanceLastUpdated.toISOString() : 'Never'}`);
      console.log(`   - Transaction Count: ${account._count.transactions}`);
      console.log(`   - Status: ${account.status || 'N/A'}`);
      
      totalBalance += account.balance;
    });

    console.log(`\nTotal Balance Across All Accounts: $${totalBalance.toFixed(2)}`);

    // 2. Check Bank Transactions
    console.log('\n\n📊 BANK TRANSACTIONS SUMMARY');
    console.log('-'.repeat(40));

    const totalTransactions = await prisma.bankTransaction.count();
    console.log(`Total Bank Transactions: ${totalTransactions}`);

    if (totalTransactions > 0) {
      // Get transaction date range
      const oldestTransaction = await prisma.bankTransaction.findFirst({
        orderBy: { date: 'asc' }
      });
      
      const newestTransaction = await prisma.bankTransaction.findFirst({
        orderBy: { date: 'desc' }
      });

      console.log(`Date Range: ${oldestTransaction?.date.toISOString().split('T')[0]} to ${newestTransaction?.date.toISOString().split('T')[0]}`);

      // Calculate financial summary
      const transactions = await prisma.bankTransaction.findMany({
        where: {
          status: 'AUTHORISED' // Only count authorized transactions
        }
      });

      const summary: TransactionSummary = {
        totalRevenue: 0,
        totalExpenses: 0,
        netProfitLoss: 0,
        transactionsByType: {
          RECEIVE: 0,
          SPEND: 0
        },
        transactionsByStatus: {},
        reconciledCount: 0,
        unreconciledCount: 0
      };

      // Process all transactions for various summaries
      const allTransactions = await prisma.bankTransaction.findMany();
      
      allTransactions.forEach(transaction => {
        // Count by type
        if (transaction.type in summary.transactionsByType) {
          summary.transactionsByType[transaction.type as keyof typeof summary.transactionsByType]++;
        }

        // Count by status
        summary.transactionsByStatus[transaction.status] = 
          (summary.transactionsByStatus[transaction.status] || 0) + 1;

        // Count reconciled
        if (transaction.isReconciled) {
          summary.reconciledCount++;
        } else {
          summary.unreconciledCount++;
        }

        // Calculate revenue and expenses (only for authorized transactions)
        if (transaction.status === 'AUTHORISED') {
          if (transaction.type === 'RECEIVE') {
            summary.totalRevenue += Math.abs(transaction.amount);
          } else if (transaction.type === 'SPEND') {
            summary.totalExpenses += Math.abs(transaction.amount);
          }
        }
      });

      summary.netProfitLoss = summary.totalRevenue - summary.totalExpenses;

      // Display transaction summary
      console.log('\nTransaction Types:');
      console.log(`   - RECEIVE (Income): ${summary.transactionsByType.RECEIVE} transactions`);
      console.log(`   - SPEND (Expense): ${summary.transactionsByType.SPEND} transactions`);

      console.log('\nTransaction Status:');
      Object.entries(summary.transactionsByStatus).forEach(([status, count]) => {
        console.log(`   - ${status}: ${count} transactions`);
      });

      console.log('\nReconciliation Status:');
      console.log(`   - Reconciled: ${summary.reconciledCount} transactions`);
      console.log(`   - Unreconciled: ${summary.unreconciledCount} transactions`);
      console.log(`   - Reconciliation Rate: ${((summary.reconciledCount / totalTransactions) * 100).toFixed(2)}%`);

      console.log('\n💰 PROFIT/LOSS CALCULATION (Based on Authorized Transactions)');
      console.log('-'.repeat(40));
      console.log(`Total Revenue (RECEIVE):  $${summary.totalRevenue.toFixed(2)}`);
      console.log(`Total Expenses (SPEND):   $${summary.totalExpenses.toFixed(2)}`);
      console.log(`${'-'.repeat(40)}`);
      console.log(`Net Profit/Loss:          $${summary.netProfitLoss.toFixed(2)}`);
      
      if (summary.netProfitLoss > 0) {
        console.log(`Status: 📈 PROFIT`);
      } else if (summary.netProfitLoss < 0) {
        console.log(`Status: 📉 LOSS`);
      } else {
        console.log(`Status: ➖ BREAK EVEN`);
      }

      // Monthly breakdown
      console.log('\n📅 MONTHLY BREAKDOWN');
      console.log('-'.repeat(40));
      
      const monthlyData = await prisma.$queryRaw<Array<{
        month: string;
        revenue: number;
        expenses: number;
        net: number;
      }>>`
        SELECT 
          strftime('%Y-%m', date) as month,
          CAST(SUM(CASE WHEN type = 'RECEIVE' AND status = 'AUTHORISED' THEN ABS(amount) ELSE 0 END) as REAL) as revenue,
          CAST(SUM(CASE WHEN type = 'SPEND' AND status = 'AUTHORISED' THEN ABS(amount) ELSE 0 END) as REAL) as expenses,
          CAST(SUM(CASE 
            WHEN type = 'RECEIVE' AND status = 'AUTHORISED' THEN ABS(amount)
            WHEN type = 'SPEND' AND status = 'AUTHORISED' THEN -ABS(amount)
            ELSE 0 
          END) as REAL) as net
        FROM BankTransaction
        WHERE date IS NOT NULL
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
      `;

      if (monthlyData.length > 0) {
        console.log('\nLast 12 Months:');
        monthlyData.forEach(month => {
          if (month.month) {
            const profitLossIndicator = month.net >= 0 ? '📈' : '📉';
            console.log(`${month.month}: Revenue: $${month.revenue.toFixed(2)}, Expenses: $${month.expenses.toFixed(2)}, Net: ${profitLossIndicator} $${month.net.toFixed(2)}`);
          }
        });
      }

      // Bank Account Breakdown
      console.log('\n🏦 TRANSACTION BREAKDOWN BY BANK ACCOUNT');
      console.log('-'.repeat(40));
      
      for (const account of bankAccounts) {
        if (account._count.transactions > 0) {
          const accountTransactions = await prisma.bankTransaction.findMany({
            where: {
              bankAccountId: account.id,
              status: 'AUTHORISED'
            }
          });

          let accountRevenue = 0;
          let accountExpenses = 0;

          accountTransactions.forEach(transaction => {
            if (transaction.type === 'RECEIVE') {
              accountRevenue += Math.abs(transaction.amount);
            } else if (transaction.type === 'SPEND') {
              accountExpenses += Math.abs(transaction.amount);
            }
          });

          const accountNet = accountRevenue - accountExpenses;
          if (accountRevenue > 0 || accountExpenses > 0) {
            console.log(`\n${account.name} (${account.currencyCode || 'N/A'}):`);
            console.log(`   Revenue: $${accountRevenue.toFixed(2)}`);
            console.log(`   Expenses: $${accountExpenses.toFixed(2)}`);
            console.log(`   Net: $${accountNet.toFixed(2)} ${accountNet >= 0 ? '📈' : '📉'}`);
          }
        }
      }
    }

    // 3. Check GL Accounts
    console.log('\n\n📊 GENERAL LEDGER ACCOUNTS');
    console.log('-'.repeat(40));
    
    const glAccountCount = await prisma.gLAccount.count();
    const glAccountsByType = await prisma.gLAccount.groupBy({
      by: ['type'],
      _count: true
    });

    console.log(`Total GL Accounts: ${glAccountCount}`);
    console.log('\nAccounts by Type:');
    glAccountsByType.forEach(type => {
      console.log(`   - ${type.type}: ${type._count} accounts`);
    });

    // 4. Check Recent Sync Activity
    console.log('\n\n🔄 RECENT SYNC ACTIVITY');
    console.log('-'.repeat(40));
    
    const recentSyncs = await prisma.syncLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 5
    });

    if (recentSyncs.length > 0) {
      console.log('Last 5 Sync Operations:');
      recentSyncs.forEach((sync, index) => {
        const duration = sync.completedAt 
          ? ((sync.completedAt.getTime() - sync.startedAt.getTime()) / 1000).toFixed(2)
          : 'In Progress';
        
        console.log(`\n${index + 1}. ${sync.syncType} - ${sync.status.toUpperCase()}`);
        console.log(`   Started: ${sync.startedAt.toISOString()}`);
        console.log(`   Duration: ${duration}s`);
        console.log(`   Records: Created ${sync.recordsCreated}, Updated ${sync.recordsUpdated}`);
        if (sync.errorMessage) {
          console.log(`   Error: ${sync.errorMessage}`);
        }
      });
    } else {
      console.log('No sync operations found.');
    }

    // 5. Data Quality Check
    console.log('\n\n✅ DATA QUALITY CHECK');
    console.log('-'.repeat(40));
    
    // Check for missing account codes
    const transactionsWithoutAccountCode = await prisma.bankTransaction.count({
      where: {
        accountCode: null,
        status: 'AUTHORISED'
      }
    });

    // Check for missing tax types
    const transactionsWithoutTaxType = await prisma.bankTransaction.count({
      where: {
        taxType: null,
        status: 'AUTHORISED'
      }
    });

    console.log(`Transactions without Account Code: ${transactionsWithoutAccountCode}`);
    console.log(`Transactions without Tax Type: ${transactionsWithoutTaxType}`);

    // Check for orphaned transactions
    const orphanedTransactions = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM BankTransaction bt
      LEFT JOIN BankAccount ba ON bt.bankAccountId = ba.id
      WHERE ba.id IS NULL
    `;

    console.log(`Orphaned Transactions (no bank account): ${orphanedTransactions[0]?.count || 0}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Database check completed successfully!\n');

  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkDatabase().catch(console.error);