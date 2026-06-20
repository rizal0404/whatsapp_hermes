import { Worker, Job, UnrecoverableError } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../common/logger';
import { MessageJobPayload } from './message.types';
import { messageRepository } from './message.repository';
import { sessionManager } from '../sessions/session.manager';
import { sessionService } from '../sessions/session.service';
import { normalizeJid } from '../whatsapp/jid.util';
import { mediaService } from '../whatsapp/media.service';
import { FileDownloadError, ValidationError } from '../common/errors';
import { prisma } from '../database/prisma';

export const startMessageWorker = () => {
  const worker = new Worker<MessageJobPayload>(
    'message-queue',
    async (job: Job<MessageJobPayload>) => {
      const { messageId, sessionId, to, type, text, document } = job.data;
      const childLogger = logger.child({ messageId, sessionId, jobId: job.id });

      childLogger.info('Worker picked up message job');

      try {
        // Check if the message log exists in database first
        const dbMessage = await messageRepository.findByMessageId(messageId);
        if (!dbMessage) {
          childLogger.error({ event: 'message.not_found' }, 'Message record not found in database, discarding job');
          throw new UnrecoverableError(`Message record '${messageId}' not found in database`);
        }

        // 1. Update status to PROCESSING and log event
        childLogger.info({ event: 'message.processing' }, 'Message processing started');
        await messageRepository.updateStatus(messageId, 'PROCESSING');
        await messageRepository.incrementAttempt(messageId);

        // 2. Resolve session client
        let client;
        try {
          client = sessionManager.getClient(sessionId);
        } catch (err) {
          childLogger.error({ event: 'session.not_found' }, 'Session not found for job');
          // If session is deleted, it's unrecoverable
          throw new UnrecoverableError(`Session '${sessionId}' not found`);
        }

        // Check if session is connected
        const dbSession = await sessionService.getSessionStatus(sessionId);
        if (dbSession.status !== 'CONNECTED' || !client.socket) {
          childLogger.warn({ event: 'session.disconnected', status: dbSession.status }, 'WhatsApp session is not connected, retrying later');
          throw new Error('WhatsApp session is not connected');
        }

        // 3. Normalize recipient JID
        const toJid = normalizeJid(to);

        // Build options (like quoted message) if replyToMessageId is present
        let sendOptions: any = {};
        if (job.data.replyToMessageId) {
          const replyId = job.data.replyToMessageId;
          let quotedText = 'Message';
          let originalSender: string | undefined = undefined;
          let fromMe = true;

          // Search in incoming message
          const inc = await prisma.incomingMessage.findFirst({
            where: { waMessageId: replyId }
          });

          if (inc) {
            quotedText = inc.content || 'Media message';
            originalSender = inc.senderJid;
            fromMe = false;
          } else {
            // Search in outgoing message
            const out = await prisma.messageLog.findUnique({
              where: { messageId: replyId }
            });
            if (out) {
              const payload = out.payload as any;
              quotedText = payload?.text || payload?.caption || 'Media message';
              fromMe = true;
            }
          }

          sendOptions.quoted = {
            key: {
              remoteJid: toJid,
              fromMe,
              id: replyId,
              participant: originalSender || undefined,
            },
            message: {
              conversation: quotedText
            }
          };
        }

        // 4. Send Message based on Type
        if (type === 'text') {
          if (!text) {
            throw new UnrecoverableError('Message text is missing for text message type');
          }
          childLogger.debug({ toJid }, 'Sending text message via Baileys');
          await client.socket.sendMessage(toJid, { text }, sendOptions);
        } else if (type === 'document') {
          if (!document) {
            throw new UnrecoverableError('Document metadata is missing for document message type');
          }
          childLogger.debug({ toJid, fileUrl: document.fileUrl }, 'Downloading report file');
          
          let fileData;
          try {
            fileData = await mediaService.downloadFile(document.fileUrl, document.mimeType);
          } catch (downloadErr: any) {
            childLogger.error({ event: 'file.download_failed', err: downloadErr.message }, 'Failed to download document');
            if (downloadErr instanceof FileDownloadError) {
              // Mark as unrecoverable if security policy violated or invalid domain/size
              throw new UnrecoverableError(downloadErr.message);
            }
            throw downloadErr; // Retry on transient network errors
          }

          childLogger.debug({ toJid }, 'Sending document message via Baileys');
          await client.socket.sendMessage(toJid, {
            document: fileData.buffer,
            mimetype: fileData.mimeType,
            fileName: document.fileName,
            caption: document.caption,
          }, sendOptions);
        }

        // 5. Success update and log event
        await messageRepository.updateStatus(messageId, 'SENT');
        childLogger.info({ event: 'message.sent' }, 'Message sent successfully');

        // Optional delay between messages: 2-5 seconds (3 seconds pacing)
        childLogger.debug('Pacing delay active, waiting 3s before next job');
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch (err: any) {
        const isUnrecoverable = err instanceof UnrecoverableError;
        
        // Check if we reached max attempts or if it is unrecoverable
        const maxAttempts = job.opts.attempts || env.MAX_RETRY_ATTEMPTS;
        const attemptsMade = job.attemptsMade + 1; // current attempt

        if (isUnrecoverable || attemptsMade >= maxAttempts) {
          childLogger.error(
            { event: 'message.failed', err: err.message, attemptsMade, maxAttempts },
            'Message sending failed permanently'
          );
          
          await messageRepository.updateStatus(messageId, 'FAILED', {
            lastError: err.message,
            failedAt: new Date(),
          });
          
          // Re-throw so BullMQ marks job as failed
          throw err;
        } else {
          childLogger.warn(
            { event: 'message.retry_scheduled', err: err.message, attempt: attemptsMade, maxAttempts },
            'Message sending failed temporarily, scheduling retry'
          );

          // BullMQ will schedule a retry automatically. Update DB to RETRYING.
          await messageRepository.updateStatus(messageId, 'RETRYING', {
            lastError: err.message,
          });
          throw err;
        }
      }
    },
    {
      connection: {
        url: env.REDIS_URL,
      },
      // Rate limiting: 1 job at a time per worker thread
      concurrency: 1,
      // Hard rate limit: max 30 messages per minute
      limiter: {
        max: 30,
        duration: 60000,
      },
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Queue Job failed');
  });

  return worker;
};
