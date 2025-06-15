import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function resetDatabase() {
  console.log('🗑️  Starting database reset...')
  
  try {
    // Delete all data in reverse order of dependencies
    console.log('Deleting all data...')
    
    // Delete dependent records first
    await prisma.cashFlowForecast.deleteMany({})
    console.log('✓ Deleted cash flow forecasts')
    
    await prisma.taxObligation.deleteMany({})
    console.log('✓ Deleted tax obligations')
    
    await prisma.cashFlowBudget.deleteMany({})
    console.log('✓ Deleted cash flow budgets')
    
    await prisma.paymentPattern.deleteMany({})
    console.log('✓ Deleted payment patterns')
    
    await prisma.repeatingTransaction.deleteMany({})
    console.log('✓ Deleted repeating transactions')
    
    await prisma.syncedInvoice.deleteMany({})
    console.log('✓ Deleted synced invoices')
    
    await prisma.bankTransaction.deleteMany({})
    console.log('✓ Deleted bank transactions')
    
    await prisma.bankAccount.deleteMany({})
    console.log('✓ Deleted bank accounts')
    
    await prisma.gLAccount.deleteMany({})
    console.log('✓ Deleted GL accounts')
    
    await prisma.standardOperatingProcedure.deleteMany({})
    console.log('✓ Deleted SOPs')
    
    await prisma.cashFlowSyncLog.deleteMany({})
    console.log('✓ Deleted cash flow sync logs')
    
    await prisma.syncLog.deleteMany({})
    console.log('✓ Deleted sync logs')
    
    // Delete the SQLite database file completely
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')
    const dbWalPath = `${dbPath}-wal`
    const dbShmPath = `${dbPath}-shm`
    
    console.log('\n🗄️  Deleting database files...')
    
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath)
      console.log('✓ Deleted dev.db')
    }
    
    if (fs.existsSync(dbWalPath)) {
      fs.unlinkSync(dbWalPath)
      console.log('✓ Deleted dev.db-wal')
    }
    
    if (fs.existsSync(dbShmPath)) {
      fs.unlinkSync(dbShmPath)
      console.log('✓ Deleted dev.db-shm')
    }
    
    console.log('\n✨ Database reset complete!')
    console.log('\n📝 Next steps:')
    console.log('1. Run "npm run prisma:migrate" to recreate the database')
    console.log('2. Start the app with "npm run dev"')
    console.log('3. Go to https://localhost:3003')
    console.log('4. Click "Connect to Xero" to start the setup flow')
    
  } catch (error) {
    console.error('❌ Error resetting database:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

resetDatabase()