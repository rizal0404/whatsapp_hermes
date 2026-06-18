import { prisma } from '../database/prisma';
import { messageService } from '../messages/message.service';
import { recipientRepository } from '../recipients/recipient.repository';
import { HermesSendDailyReportInput } from './hermes.schema';
import { ValidationError, SessionNotFoundError, AppError } from '../common/errors';
import { MessageBatch } from '@prisma/client';
import { sessionRepository } from '../sessions/session.repository';
import { logger } from '../common/logger';

export class HermesService {
  private generateBatchId(prefix: string = 'batch_'): string {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${randomHex}`;
  }

  async sendDailyReport(input: HermesSendDailyReportInput): Promise<MessageBatch> {
    const { reportDate, sessionId, message, recipients, document } = input;

    // 1. Verify session exists
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    // 2. Generate batch key for idempotency
    const batchKey = `batch_${sessionId}_${reportDate}`;

    // Check if batch already exists
    const existingBatch = await prisma.messageBatch.findUnique({
      where: { batchKey },
    });
    if (existingBatch) {
      logger.info({ batchKey }, 'Hermes daily report batch already processed (duplicate request)');
      return existingBatch;
    }

    // 3. Resolve recipients
    let resolvedRecipients: { to: string; type: 'phone' | 'group' }[] = [];

    if (recipients && recipients.length > 0) {
      resolvedRecipients = recipients;
    } else {
      // Fetch from gateway database
      const dbRecipients = await recipientRepository.listAll(true); // only active
      resolvedRecipients = dbRecipients.map((r) => ({
        to: r.to,
        type: r.type as 'phone' | 'group',
      }));
    }

    if (resolvedRecipients.length === 0) {
      throw new ValidationError('No active recipients resolved for daily report');
    }

    // 4. Create Message Batch
    const batchId = this.generateBatchId();
    const batch = await prisma.messageBatch.create({
      data: {
        id: undefined, // let database generate UUID
        batchKey,
        source: 'Hermes',
        status: 'QUEUED',
        totalMessages: resolvedRecipients.length,
      },
    });

    // 5. Enqueue message sending for each recipient
    for (const recipient of resolvedRecipients) {
      const idempotencyKey = `daily-report-${sessionId}-${reportDate}-${recipient.to}`;

      try {
        if (document) {
          await messageService.sendDocument({
            sessionId,
            to: recipient.to,
            caption: message,
            fileUrl: document.fileUrl,
            fileName: document.fileName,
            mimeType: document.mimeType,
            idempotencyKey,
            batchId: batch.id,
          });
        } else {
          await messageService.sendText({
            sessionId,
            to: recipient.to,
            message,
            idempotencyKey,
            batchId: batch.id,
          });
        }
      } catch (err: any) {
        logger.error(
          { err: err.message, recipient: recipient.to, batchId: batch.id },
          'Failed to queue message for batch recipient'
        );
      }
    }

    return batch;
  }

  async getBatchStatus(batchId: string) {
    const batch = await prisma.messageBatch.findUnique({
      where: { id: batchId },
      include: {
        messages: {
          select: {
            messageId: true,
            recipient: true,
            status: true,
            attempt: true,
            lastError: true,
            sentAt: true,
          },
        },
      },
    });

    if (!batch) {
      throw new AppError('VALIDATION_ERROR', `Message batch with ID '${batchId}' not found`, 404);
    }

    // Calculate aggregated counts and update status if needed
    const messages = batch.messages;
    const successCount = messages.filter((m) => m.status === 'SENT').length;
    const failedCount = messages.filter((m) => m.status === 'FAILED').length;
    
    let currentStatus = batch.status;
    if (successCount + failedCount === batch.totalMessages) {
      currentStatus = failedCount > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';
    } else if (successCount > 0 || failedCount > 0) {
      currentStatus = 'PROCESSING';
    }

    // Update batch in DB if status or counts changed
    if (
      currentStatus !== batch.status ||
      successCount !== batch.successCount ||
      failedCount !== batch.failedCount
    ) {
      const updated = await prisma.messageBatch.update({
        where: { id: batchId },
        data: {
          status: currentStatus,
          successCount,
          failedCount,
          completedAt: currentStatus.startsWith('COMPLETED') ? new Date() : null,
        },
      });
      
      return {
        ...updated,
        messages,
      };
    }

    return batch;
  }
}

export const hermesService = new HermesService();
