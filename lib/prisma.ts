import { PrismaClient } from '@prisma/client'
import { structuredLogger } from './logger'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Configure Prisma with proper timeout and connection settings
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['error', 'warn'] 
    : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'file:./dev.db'
    }
  },
  // Add timeout configuration to prevent SQLite lockups
  transactionOptions: {
    maxWait: 5000, // 5 seconds max wait to acquire a database connection
    timeout: 30000, // 30 seconds max execution time
    isolationLevel: 'ReadCommitted'
  }
})

// Handle connection errors gracefully
prisma.$on('error', (e) => {
  structuredLogger.error('Prisma database error', e, {
    component: 'prisma',
    target: e.target
  })
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})