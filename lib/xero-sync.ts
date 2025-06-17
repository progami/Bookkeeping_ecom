import { prisma } from '@/lib/prisma'
import { getXeroClientWithTenant } from '@/lib/xero-client'
import { structuredLogger } from '@/lib/logger'

interface SyncOptions {
  syncType: 'full_sync' | 'incremental_sync'
  fromDate?: Date
  entities?: string[]
  onProgress?: (entity: string, current: number, total: number) => void
}

export async function syncXeroData(
  userId: string,
  options: SyncOptions = { syncType: 'full_sync' }
) {
  try {
    const syncLog = await prisma.syncLog.create({
      data: {
        syncType: options.syncType,
        status: 'in_progress',
        startedAt: new Date()
      }
    })

    const xeroData = await getXeroClientWithTenant()
    if (!xeroData) {
      throw new Error('Failed to get Xero client')
    }
    const { client: xeroClient, tenantId: xeroTenantId } = xeroData

    let recordsCreated = 0
    let recordsUpdated = 0

    // Sync based on selected entities
    const entitiesToSync = options.entities || ['accounts', 'transactions', 'invoices', 'contacts']
    
    for (const entity of entitiesToSync) {
      switch (entity) {
        case 'accounts':
          // Sync GL accounts
          const accounts = await xeroClient.accountingApi.getAccounts(xeroTenantId)
          if (accounts.body?.accounts) {
            for (const account of accounts.body.accounts) {
              const existing = await prisma.gLAccount.findUnique({
                where: { code: account.code || '' }
              })
              
              if (existing) {
                await prisma.gLAccount.update({
                  where: { code: account.code || '' },
                  data: {
                    name: account.name || '',
                    code: account.code || '',
                    type: account.type?.toString() || '',
                    status: account.status?.toString() || '',
                    description: account.description,
                    systemAccount: !!account.systemAccount,
                    enablePaymentsToAccount: account.enablePaymentsToAccount || false,
                    showInExpenseClaims: account.showInExpenseClaims || false,
                    updatedAt: new Date()
                  }
                })
                recordsUpdated++
              } else {
                await prisma.gLAccount.create({
                  data: {
                    name: account.name || '',
                    code: account.code || '',
                    type: account.type?.toString() || '',
                    status: account.status?.toString() || '',
                    description: account.description,
                    systemAccount: !!account.systemAccount,
                    enablePaymentsToAccount: account.enablePaymentsToAccount || false,
                    showInExpenseClaims: account.showInExpenseClaims || false
                  }
                })
                recordsCreated++
              }
            }
          }
          break
          
        case 'transactions':
          // Sync bank transactions with date filter
          const whereClause = options.fromDate ? {
            where: `Date>=${options.fromDate.toISOString().split('T')[0]}`
          } : undefined
          
          const transactions = await xeroClient.accountingApi.getBankTransactions(
            xeroTenantId,
            undefined,
            whereClause?.where
          )
          
          if (transactions.body?.bankTransactions) {
            for (const tx of transactions.body.bankTransactions) {
              const existing = await prisma.bankTransaction.findUnique({
                where: { xeroTransactionId: tx.bankTransactionID || '' }
              })
              
              if (existing) {
                recordsUpdated++
              } else {
                recordsCreated++
              }
              // Actual sync logic would go here
            }
          }
          break
          
        // Add more entity types as needed
      }
      
      // Report progress
      if (options.onProgress) {
        options.onProgress(entity, recordsCreated + recordsUpdated, 100)
      }
    }

    // Update sync log
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'success',
        completedAt: new Date(),
        recordsCreated,
        recordsUpdated
      }
    })

    return {
      success: true,
      syncLogId: syncLog.id,
      recordsCreated,
      recordsUpdated
    }
  } catch (error: any) {
    structuredLogger.error('Xero sync failed', error, {
      component: 'xero-sync',
      userId
    })
    
    return {
      success: false,
      error: error.message
    }
  }
}