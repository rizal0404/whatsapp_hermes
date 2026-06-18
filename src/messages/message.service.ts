import crypto from 'crypto';
import { messageRepository } from './message.repository';
import { addMessageJob } from './message.queue';
import { logger } from '../common/logger';
import {
  SendTextMessageInput,
  SendDocumentMessageInput,
  MessageJobPayload,
} from './message.types';
import { normalizeJid, getRecipientType } from '../whatsapp/jid.util';
import { ValidationError, SessionNotFoundError } from '../common/errors';
import { MessageLog } from '@prisma/client';
import { sessionRepository } from '../sessions/session.repository';

export class MessageService {
  private generateMessageId(): string {
    const randomHex = crypto.randomBytes(5).toString('hex').toUpperCase();
    return `msg_${randomHex}`;
  }

  async sendText(input: SendTextMessageInput & { batchId?: string }): Promise<MessageLog> {
    const { sessionId, to, message, idempotencyKey, batchId } = input;

    // 1. Check if session exists in DB
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    // 2. Check Idempotency Key
    const existing = await messageRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      return existing;
    }

    // 3. Normalize recipient
    const recipientJid = normalizeJid(to);
    const recipientType = getRecipientType(recipientJid);
    const messageId = this.generateMessageId();

    const payload = { text: message };

    // 4. Save to Message Log as QUEUED
    const log = await messageRepository.create({
      messageId,
      sessionId,
      recipient: recipientJid,
      recipientType,
      messageType: 'text',
      idempotencyKey,
      status: 'QUEUED',
      payload,
      batchId,
    });

    // 5. Add to queue worker
    const jobPayload: MessageJobPayload = {
      messageId,
      sessionId,
      to: recipientJid,
      type: 'text',
      text: message,
    };
    await addMessageJob(jobPayload);

    logger.info({ messageId, sessionId, event: 'message.queued' }, 'Message queued');

    return log;
  }

  async sendDocument(input: SendDocumentMessageInput & { batchId?: string }): Promise<MessageLog> {
    const { sessionId, to, caption, fileUrl, fileName, mimeType, idempotencyKey, batchId } = input;

    // 1. Check if session exists in DB
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    // 2. Check Idempotency Key
    const existing = await messageRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      return existing;
    }

    // 3. Normalize recipient
    const recipientJid = normalizeJid(to);
    const recipientType = getRecipientType(recipientJid);
    const messageId = this.generateMessageId();

    const payload = {
      caption,
      fileUrl,
      fileName,
      mimeType,
    };

    // 4. Save to Message Log as QUEUED
    const log = await messageRepository.create({
      messageId,
      sessionId,
      recipient: recipientJid,
      recipientType,
      messageType: 'document',
      idempotencyKey,
      status: 'QUEUED',
      payload,
      batchId,
    });

    // 5. Add to queue worker
    const jobPayload: MessageJobPayload = {
      messageId,
      sessionId,
      to: recipientJid,
      type: 'document',
      document: {
        fileUrl,
        fileName,
        mimeType,
        caption,
      },
    };
    await addMessageJob(jobPayload);

    logger.info({ messageId, sessionId, event: 'message.queued' }, 'Message queued');

    return log;
  }

  async getMessageStatus(messageId: string): Promise<MessageLog> {
    const log = await messageRepository.findByMessageId(messageId);
    if (!log) {
      throw new ValidationError(`Message with ID '${messageId}' not found`);
    }
    return log;
  }
}

export const messageService = new MessageService();
