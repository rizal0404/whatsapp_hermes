import { Queue } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../common/logger';
import { MessageJobPayload } from './message.types';

const queueName = 'message-queue';

export const messageQueue = new Queue<MessageJobPayload>(queueName, {
  connection: {
    url: env.REDIS_URL,
  },
  defaultJobOptions: {
    attempts: env.MAX_RETRY_ATTEMPTS,
    backoff: {
      type: 'exponential',
      delay: 10000, // 10 seconds initial delay
    },
    removeOnComplete: {
      age: env.MESSAGE_JOB_TTL_SECONDS, // Keep completed jobs for TTL seconds
    },
    removeOnFail: {
      age: env.MESSAGE_JOB_TTL_SECONDS * 24, // Keep failed jobs for 24 hours
    },
  },
});

export const addMessageJob = async (payload: MessageJobPayload): Promise<void> => {
  try {
    const job = await messageQueue.add(`send-${payload.type}-${payload.messageId}`, payload, {
      jobId: payload.messageId, // Use messageId as jobId to prevent duplicate queueing
    });
    logger.debug({ jobId: job.id, messageId: payload.messageId }, 'Job added to message queue');
  } catch (err) {
    logger.error({ err, messageId: payload.messageId }, 'Failed to add job to message queue');
    throw err;
  }
};
