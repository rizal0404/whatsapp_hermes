import { incomingService } from './incoming.service';
import { logger } from '../common/logger';

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // Run once every 24 hours

export function startIncomingCleanup(): void {
  // Run once on startup (delayed by 60 seconds to let app initialize)
  setTimeout(async () => {
    try {
      const count = await incomingService.cleanupOldMessages();
      if (count > 0) logger.info({ deletedCount: count }, 'Incoming messages cleanup completed');
    } catch (err) {
      logger.error({ err }, 'Incoming messages cleanup failed');
    }
  }, 60_000);

  // Then run periodically
  setInterval(async () => {
    try {
      const count = await incomingService.cleanupOldMessages();
      if (count > 0) logger.info({ deletedCount: count }, 'Incoming messages cleanup completed');
    } catch (err) {
      logger.error({ err }, 'Incoming messages cleanup failed');
    }
  }, CLEANUP_INTERVAL_MS);

  logger.info({ intervalHours: 24 }, 'Incoming messages cleanup scheduler started');
}
