import { prisma } from '../database/prisma';
import { MessageLog } from '@prisma/client';
import { MessageStatus } from './message.types';

export class MessageRepository {
  async create(data: {
    messageId: string;
    sessionId: string;
    recipient: string;
    recipientType: string;
    messageType: string;
    idempotencyKey: string;
    status: MessageStatus;
    payload: any;
    maxAttempt?: number;
    batchId?: string;
  }): Promise<MessageLog> {
    return prisma.messageLog.create({
      data: {
        messageId: data.messageId,
        sessionId: data.sessionId,
        recipient: data.recipient,
        recipientType: data.recipientType,
        messageType: data.messageType,
        idempotencyKey: data.idempotencyKey,
        status: data.status,
        payload: data.payload,
        maxAttempt: data.maxAttempt ?? 3,
        batchId: data.batchId,
        queuedAt: new Date(),
      },
    });
  }

  async findByMessageId(messageId: string): Promise<MessageLog | null> {
    return prisma.messageLog.findUnique({
      where: { messageId },
    });
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<MessageLog | null> {
    return prisma.messageLog.findUnique({
      where: { idempotencyKey },
    });
  }

  async updateStatus(
    messageId: string,
    status: MessageStatus,
    extra: Partial<Omit<MessageLog, 'id' | 'messageId' | 'status' | 'createdAt' | 'updatedAt'>> = {}
  ): Promise<MessageLog> {
    const data: any = { status, ...extra };
    
    if (status === 'PROCESSING') {
      data.processingAt = new Date();
    } else if (status === 'SENT') {
      data.sentAt = new Date();
    } else if (status === 'FAILED') {
      data.failedAt = new Date();
    }

    return prisma.messageLog.update({
      where: { messageId },
      data,
    });
  }

  async incrementAttempt(messageId: string, lastError?: string): Promise<MessageLog> {
    return prisma.messageLog.update({
      where: { messageId },
      data: {
        attempt: {
          increment: 1,
        },
        lastError,
      },
    });
  }
}

export const messageRepository = new MessageRepository();
