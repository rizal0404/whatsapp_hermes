import { prisma } from '../database/prisma';
import { IncomingMessage } from '@prisma/client';
import { IncomingMessageData, IncomingMessageFilters } from './incoming.types';

export class IncomingMessageRepository {
  async create(data: IncomingMessageData): Promise<IncomingMessage> {
    return prisma.incomingMessage.create({
      data: {
        sessionId: data.sessionId,
        remoteJid: data.remoteJid,
        senderJid: data.senderJid,
        senderName: data.senderName,
        waMessageId: data.waMessageId,
        triggerType: data.triggerType,
        messageType: data.messageType,
        content: data.content,
        quotedMessageId: data.quotedMessageId,
        quotedContent: data.quotedContent,
        isGroup: data.isGroup,
        groupName: data.groupName,
        messageTimestamp: data.messageTimestamp,
        rawPayload: data.rawPayload ?? undefined,
      },
    });
  }

  async findBySessionAndWaMessageId(
    sessionId: string,
    waMessageId: string
  ): Promise<IncomingMessage | null> {
    return prisma.incomingMessage.findUnique({
      where: {
        sessionId_waMessageId: { sessionId, waMessageId },
      },
    });
  }

  async listBySession(
    sessionId: string,
    filters: IncomingMessageFilters
  ): Promise<{ messages: IncomingMessage[]; total: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const sortOrder = filters.sortOrder ?? 'desc';
    const skip = (page - 1) * limit;

    const where: any = { sessionId };

    if (filters.triggerType !== undefined) {
      where.triggerType = filters.triggerType;
    }

    if (filters.isGroup !== undefined) {
      where.isGroup = filters.isGroup;
    }

    if (filters.isRead !== undefined) {
      where.isRead = filters.isRead;
    }

    const [messages, total] = await Promise.all([
      prisma.incomingMessage.findMany({
        where,
        orderBy: { messageTimestamp: sortOrder },
        skip,
        take: limit,
      }),
      prisma.incomingMessage.count({ where }),
    ]);

    return { messages, total };
  }

  async findById(id: string): Promise<IncomingMessage | null> {
    return prisma.incomingMessage.findUnique({
      where: { id },
    });
  }

  async markAsRead(id: string): Promise<IncomingMessage> {
    return prisma.incomingMessage.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(sessionId: string): Promise<number> {
    const result = await prisma.incomingMessage.updateMany({
      where: { sessionId, isRead: false },
      data: { isRead: true },
    });
    return result.count;
  }

  async getUnreadCount(sessionId: string): Promise<number> {
    return prisma.incomingMessage.count({
      where: { sessionId, isRead: false },
    });
  }

  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await prisma.incomingMessage.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });
    return result.count;
  }
}

export const incomingRepository = new IncomingMessageRepository();
