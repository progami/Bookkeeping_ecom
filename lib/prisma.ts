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
  }
})

// Handle connection errors gracefully
// Note: Prisma doesn't have a built-in error event handler
// Errors are handled through the log configuration above

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Import and configure database after Prisma is initialized
if (typeof window === 'undefined') {
  import('./database-config').then(({ databaseConfig }) => {
    databaseConfig.configure().catch(error => {
      structuredLogger.error('Database configuration failed', error);
    });
  });
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})