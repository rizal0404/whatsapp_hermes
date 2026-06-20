import { incomingRepository } from './incoming.repository';
import { addWebhookJob } from './incoming.webhook.queue';
import { incomingWebhookService } from './incoming.webhook';
import { logger } from '../common/logger';
import { env } from '../config/env';

export class IncomingPoller {
  private interval: NodeJS.Timeout | null = null;

  start(): void {
    const intervalMs = env.INCOMING_POLL_INTERVAL_MS;
    logger.info({ intervalMs }, 'Starting incoming messages webhook poller');

    // Run first poll after 30 seconds delay to let queues initialize
    setTimeout(() => {
      this.poll().catch((err) => logger.error({ err }, 'Error in initial poll'));
    }, 30000);

    this.interval = setInterval(async () => {
      try {
        await this.poll();
      } catch (err) {
        logger.error({ err }, 'Error during incoming messages webhook poll');
      }
    }, intervalMs);
  }

  async poll(): Promise<number> {
    logger.debug('Polling for undelivered webhooks...');

    // Find up to 100 undelivered incoming messages
    const messages = await incomingRepository.findUndeliveredWebhooks(100);
    if (messages.length === 0) {
      return 0;
    }

    logger.info({ count: messages.length }, 'Found undelivered incoming messages, re-queueing webhooks');

    const urls = await incomingWebhookService.getWebhookUrls();
    let queuedCount = 0;

    for (const msg of messages) {
      for (const url of urls) {
        try {
          await addWebhookJob({ messageId: msg.id, webhookUrl: url });
          queuedCount++;
        } catch (err) {
          logger.error({ err, messageId: msg.id, url }, 'Failed to re-queue webhook job in poller');
        }
      }
    }

    return queuedCount;
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('Incoming messages webhook poller stopped');
    }
  }
}

export const incomingPoller = new IncomingPoller();
export default incomingPoller;
