import { Queue } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../common/logger';

const queueName = 'incoming-webhook-queue';

export interface WebhookJobPayload {
  messageId: string; // The database UUID of the IncomingMessage
  webhookUrl: string;
}

export const webhookQueue = new Queue<WebhookJobPayload>(queueName, {
  connection: {
    url: env.REDIS_URL,
  },
  defaultJobOptions: {
    attempts: env.WEBHOOK_MAX_RETRIES,
    backoff: {
      type: 'exponential',
      delay: env.WEBHOOK_RETRY_DELAY_MS,
    },
    removeOnComplete: {
      age: 3600, // Keep for 1 hour
    },
    removeOnFail: {
      age: 86400, // Keep for 24 hours
    },
  },
});

export const addWebhookJob = async (payload: WebhookJobPayload): Promise<void> => {
  try {
    // Generate a unique jobId to prevent duplicate webhook dispatches for the same message to the same url
    const urlHash = Buffer.from(payload.webhookUrl).toString('base64').replace(/=/g, '');
    const jobId = `webhook-${payload.messageId}-${urlHash}`;
    
    const job = await webhookQueue.add(`webhook-${payload.messageId}`, payload, {
      jobId,
    });
    logger.debug({ jobId: job.id, messageId: payload.messageId }, 'Job added to webhook queue');
  } catch (err) {
    logger.error({ err, messageId: payload.messageId }, 'Failed to add job to webhook queue');
    throw err;
  }
};
