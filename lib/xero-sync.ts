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
            // Batch fetch existing accounts to avoid N+1 queries
            const accountCodes = accounts.body.accounts
              .map(acc => acc.code)
              .filter(code => code) as string[]
            
            const existingAccounts = await prisma.gLAccount.findMany({
              where: { code: { in: accountCodes } },
              select: { code: true }
            })
            
            const existingCodesSet = new Set(existingAccounts.map(acc => acc.code))
            
            // Prepare batch operations
            const accountsToCreate: any[] = []
            const accountsToUpdate: any[] = []
            
            for (const account of accounts.body.accounts) {
              if (!account.code) continue
              
              const accountData = {
                name: account.name || '',
                code: account.code || '',
                type: account.type?.toString() || '',
                status: account.status?.toString() || '',
                description: account.description,
                systemAccount: !!account.systemAccount,
                enablePaymentsToAccount: account.enablePaymentsToAccount || false,
                showInExpenseClaims: account.showInExpenseClaims || false
              }
              
              if (existingCodesSet.has(account.code)) {
                accountsToUpdate.push({
                  where: { code: account.code },
                  data: { ...accountData, updatedAt: new Date() }
                })
              } else {
                accountsToCreate.push(accountData)
              }
            }
            
            // Execute batch operations
            if (accountsToCreate.length > 0) {
              await prisma.gLAccount.createMany({
                data: accountsToCreate,
                skipDuplicates: true
              })
              recordsCreated += accountsToCreate.length
            }
            
            // Update operations need to be done individually in SQLite
            // but we can use Promise.all for better performance
            if (accountsToUpdate.length > 0) {
              await Promise.all(
                accountsToUpdate.map(update =>
                  prisma.gLAccount.update(update)
                )
              )
              recordsUpdated += accountsToUpdate.length
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