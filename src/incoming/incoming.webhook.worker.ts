import { Worker, Job, UnrecoverableError } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../common/logger';
import { WebhookJobPayload } from './incoming.webhook.queue';
import { incomingRepository } from './incoming.repository';
import { incomingWebhookService } from './incoming.webhook';

export const startWebhookWorker = () => {
  const worker = new Worker<WebhookJobPayload>(
    'incoming-webhook-queue',
    async (job: Job<WebhookJobPayload>) => {
      const { messageId, webhookUrl } = job.data;
      const childLogger = logger.child({ messageId, webhookUrl, jobId: job.id });

      childLogger.info('Webhook worker picked up job');

      const message = await incomingRepository.findById(messageId);
      if (!message) {
        throw new UnrecoverableError(`Incoming message with ID '${messageId}' not found in database`);
      }

      // Update attempt count in database
      await incomingRepository.incrementWebhookAttempt(messageId);

      const result = await incomingWebhookService.dispatchWebhook(
        webhookUrl,
        'message.incoming',
        message
      );

      if (result.success) {
        childLogger.info('Webhook delivered successfully');
        await incomingRepository.updateWebhookStatus(messageId, 'DELIVERED');
      } else {
        const errorMsg = result.error || `HTTP Status ${result.statusCode}`;
        childLogger.warn({ error: errorMsg }, 'Webhook delivery attempt failed');

        const maxAttempts = job.opts.attempts || env.WEBHOOK_MAX_RETRIES;
        const attemptsMade = job.attemptsMade + 1;

        if (attemptsMade >= maxAttempts) {
          childLogger.error('Webhook delivery failed permanently');
          await incomingRepository.updateWebhookStatus(messageId, 'FAILED', errorMsg);
        } else {
          await incomingRepository.updateWebhookStatus(messageId, 'PENDING', errorMsg);
        }

        // Throw error so BullMQ schedules a retry
        throw new Error(errorMsg);
      }
    },
    {
      connection: {
        url: env.REDIS_URL,
      },
      concurrency: 5, // Process up to 5 webhooks concurrently
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Webhook Queue Job failed');
  });

  return worker;
};
