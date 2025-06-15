import { prisma } from './prisma';
import { redis } from './redis';
import { stopBackgroundCleanup } from './oauth-state';
import { structuredLogger, winstonLogger } from './logger';

interface ShutdownHandler {
  name: string;
  handler: () => Promise<void>;
  timeout?: number;
}

class GracefulShutdown {
  private handlers: ShutdownHandler[] = [];
  private isShuttingDown = false;
  private shutdownTimeout = 30000; // 30 seconds default

  constructor() {
    // Register default handlers
    this.registerDefaultHandlers();
    
    // Listen for shutdown signals
    this.setupSignalHandlers();
  }

  private registerDefaultHandlers() {
    // Prisma cleanup
    this.register({
      name: 'Prisma',
      handler: async () => {
        structuredLogger.info('Disconnecting Prisma...', { component: 'shutdown' });
        await prisma.$disconnect();
        structuredLogger.info('Prisma disconnected', { component: 'shutdown' });
      },
      timeout: 5000
    });

    // Redis cleanup
    this.register({
      name: 'Redis',
      handler: async () => {
        structuredLogger.info('Disconnecting Redis...', { component: 'shutdown' });
        await redis.quit();
        structuredLogger.info('Redis disconnected', { component: 'shutdown' });
      },
      timeout: 5000
    });

    // OAuth state cleanup
    this.register({
      name: 'OAuth State Cleanup',
      handler: async () => {
        structuredLogger.info('Stopping OAuth state cleanup...', { component: 'shutdown' });
        stopBackgroundCleanup();
        structuredLogger.info('OAuth state cleanup stopped', { component: 'shutdown' });
      },
      timeout: 1000
    });

    // Winston logger cleanup
    this.register({
      name: 'Winston Logger',
      handler: async () => {
        structuredLogger.info('Flushing Winston logger...', { component: 'shutdown' });
        await new Promise((resolve) => {
          winstonLogger.end(() => resolve(undefined));
        });
        structuredLogger.info('Winston logger flushed', { component: 'shutdown' });
      },
      timeout: 3000
    });
  }

  private setupSignalHandlers() {
    // Handle different termination signals
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        structuredLogger.info('Received shutdown signal', { signal, component: 'shutdown' });
        await this.shutdown();
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      structuredLogger.error('Uncaught exception', error, { component: 'shutdown' });
      await this.shutdown(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      structuredLogger.error('Unhandled rejection', reason, { promise, component: 'shutdown' });
      await this.shutdown(1);
    });
  }

  register(handler: ShutdownHandler) {
    this.handlers.push(handler);
    structuredLogger.info('Registered shutdown handler', { handler: handler.name, component: 'shutdown' });
  }

  async shutdown(exitCode = 0) {
    if (this.isShuttingDown) {
      structuredLogger.info('Already shutting down...', { component: 'shutdown' });
      return;
    }

    this.isShuttingDown = true;
    structuredLogger.info('Starting graceful shutdown...', { component: 'shutdown' });

    // Set overall timeout
    const shutdownTimer = setTimeout(() => {
      structuredLogger.error('Shutdown timeout exceeded, forcing exit', undefined, { component: 'shutdown', exitCode });
      process.exit(exitCode);
    }, this.shutdownTimeout);

    try {
      // Execute all handlers in parallel with individual timeouts
      await Promise.all(
        this.handlers.map(({ name, handler, timeout }) =>
          this.executeHandler(name, handler, timeout)
        )
      );

      structuredLogger.info('All handlers completed successfully', { component: 'shutdown' });
    } catch (error) {
      structuredLogger.error('Error during shutdown', error, { component: 'shutdown' });
    } finally {
      clearTimeout(shutdownTimer);
      structuredLogger.info('Exiting', { component: 'shutdown', exitCode });
      process.exit(exitCode);
    }
  }

  private async executeHandler(
    name: string,
    handler: () => Promise<void>,
    timeout = 10000
  ): Promise<void> {
    try {
      await Promise.race([
        handler(),
        new Promise<void>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Handler timeout: ${name}`)),
            timeout
          )
        )
      ]);
    } catch (error) {
      structuredLogger.error('Handler failed', error, { component: 'shutdown', handler: name });
      // Don't throw - allow other handlers to complete
    }
  }
}

// Create singleton instance
export const gracefulShutdown = new GracefulShutdown();

// Export convenience functions
export function registerShutdownHandler(handler: ShutdownHandler) {
  gracefulShutdown.register(handler);
}

export function shutdown(exitCode = 0) {
  return gracefulShutdown.shutdown(exitCode);
}

// Ensure the module is loaded to set up signal handlers
structuredLogger.info('Graceful shutdown initialized', { component: 'shutdown' });