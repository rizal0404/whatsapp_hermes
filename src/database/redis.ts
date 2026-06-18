import { Queue, QueueEvents } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../common/logger';

export const redisConnection = {
  url: env.REDIS_URL,
};

// We will export a function to check Redis health
export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    // We can create a temporary Queue or use a ping via ioredis.
    // Since bullmq uses ioredis internally, we can check it.
    // A simple way is to instantiate a Queue and check if it can connect.
    const tempQueue = new Queue('health-check-queue', {
      connection: {
        url: env.REDIS_URL,
        // Close connection quickly
        maxRetriesPerRequest: null,
      }
    });
    const client = await tempQueue.client;
    const pong = await (client as any).ping();
    await tempQueue.close();
    return pong === 'PONG';
  } catch (err) {
    logger.error({ err }, 'Redis health check failed');
    return false;
  }
};
