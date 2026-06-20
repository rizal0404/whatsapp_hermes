import { buildApp } from './app';
import { env } from './config/env';
import { logger } from './common/logger';
import { prisma } from './database/prisma';
import { sessionManager } from './sessions/session.manager';
import { startMessageWorker } from './messages/message.worker';
import { startIncomingCleanup } from './incoming/incoming.cleanup';

const app = buildApp();
let messageWorker: any = null;

const start = async () => {
  try {
    const address = await app.listen({
      port: env.PORT,
      host: '0.0.0.0', // Essential for Docker mapping
    });
    logger.info(`⚡ Server running on address ${address} (env: ${env.NODE_ENV})`);
    
    // Start BullMQ Worker
    messageWorker = startMessageWorker();
    logger.info('⚙️ Message queue worker started.');

    // Initialize sessions in background after server is up
    sessionManager.initAllSessions();

    // Start incoming messages cleanup scheduler
    startIncomingCleanup();
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
};

// Graceful Shutdown Strategy
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  // 1. Close Fastify Server listener
  try {
    await app.close();
    logger.info('Fastify server listener closed.');
  } catch (err) {
    logger.error({ err }, 'Error closing Fastify server');
  }

  // 2. Stop BullMQ queue worker
  if (messageWorker) {
    try {
      await messageWorker.close();
      logger.info('BullMQ worker closed.');
    } catch (err) {
      logger.error({ err }, 'Error closing BullMQ worker');
    }
  }

  // 3. Shut down all active WhatsApp sessions
  try {
    await sessionManager.shutdownAll();
    logger.info('All active WhatsApp sessions shutdown.');
  } catch (err) {
    logger.error({ err }, 'Error shutting down WhatsApp sessions');
  }

  // 4. Disconnect database client
  try {
    await prisma.$disconnect();
    logger.info('Prisma database connection closed.');
  } catch (err) {
    logger.error({ err }, 'Error disconnecting Prisma client');
  }

  logger.info('Graceful shutdown completed successfully. Exiting.');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();


