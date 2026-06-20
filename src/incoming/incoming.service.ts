import { incomingRepository } from './incoming.repository';
import { sessionRepository } from '../sessions/session.repository';
import { settingsRepository } from '../settings/settings.repository';
import { logger } from '../common/logger';
import { SessionNotFoundError, AppError } from '../common/errors';
import { IncomingMessage } from '@prisma/client';
import { IncomingMessageData, IncomingMessageFilters } from './incoming.types';
import { env } from '../config/env';

export class IncomingService {
  async saveIncomingMessage(data: IncomingMessageData): Promise<void> {
    try {
      // Dedup check
      const existing = await incomingRepository.findBySessionAndWaMessageId(
        data.sessionId,
        data.waMessageId
      );

      if (existing) {
        logger.debug(
          { sessionId: data.sessionId, waMessageId: data.waMessageId },
          'Duplicate incoming message ignored'
        );
        return;
      }

      const message = await incomingRepository.create(data);
      logger.info(
        { id: message.id, sessionId: message.sessionId, triggerType: message.triggerType },
        'Saved incoming message'
      );

      // Fire webhook async
      this.fireWebhook(message).catch((err) => {
        logger.error({ err }, 'Error in fireWebhook background task');
      });
    } catch (err) {
      logger.error({ err, data }, 'Failed to save incoming message');
    }
  }

  async listMessages(
    sessionId: string,
    filters: IncomingMessageFilters
  ): Promise<{
    sessionId: string;
    messages: IncomingMessage[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    const { messages, total } = await incomingRepository.listBySession(sessionId, filters);

    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const totalPages = Math.ceil(total / limit);

    return {
      sessionId,
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async getMessage(sessionId: string, id: string): Promise<IncomingMessage> {
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    const message = await incomingRepository.findById(id);
    if (!message) {
      throw new AppError('VALIDATION_ERROR', `Incoming message with ID '${id}' not found`, 404);
    }

    if (message.sessionId !== sessionId) {
      throw new AppError(
        'UNAUTHORIZED',
        `Incoming message does not belong to session '${sessionId}'`,
        403
      );
    }

    return message;
  }

  async markAsRead(sessionId: string, id: string): Promise<IncomingMessage> {
    // Validate session and ownership
    const message = await this.getMessage(sessionId, id);

    if (message.isRead) {
      return message;
    }

    return incomingRepository.markAsRead(id);
  }

  async markAllAsRead(sessionId: string): Promise<number> {
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    return incomingRepository.markAllAsRead(sessionId);
  }

  async getUnreadCount(sessionId: string): Promise<number> {
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    return incomingRepository.getUnreadCount(sessionId);
  }

  async fireWebhook(message: IncomingMessage): Promise<void> {
    try {
      const webhookUrlSetting = await settingsRepository.get('webhookUrl');
      const webhookUrl = webhookUrlSetting || env.WEBHOOK_URL;

      if (!webhookUrl || webhookUrl.trim() === '') {
        return;
      }

      logger.debug({ webhookUrl, messageId: message.id }, 'Firing incoming message webhook');

      // Use native global fetch
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'message.incoming',
          timestamp: new Date().toISOString(),
          data: {
            id: message.id,
            sessionId: message.sessionId,
            remoteJid: message.remoteJid,
            senderJid: message.senderJid,
            senderName: message.senderName,
            waMessageId: message.waMessageId,
            triggerType: message.triggerType,
            messageType: message.messageType,
            content: message.content,
            quotedMessageId: message.quotedMessageId,
            quotedContent: message.quotedContent,
            isGroup: message.isGroup,
            groupName: message.groupName,
            isRead: message.isRead,
            messageTimestamp: message.messageTimestamp.toISOString(),
            createdAt: message.createdAt.toISOString(),
          },
        }),
      });

      if (!response.ok) {
        logger.warn(
          { webhookUrl, status: response.status, statusText: response.statusText },
          'Webhook request failed'
        );
      } else {
        logger.debug({ webhookUrl, messageId: message.id }, 'Webhook fired successfully');
      }
    } catch (err) {
      logger.error({ err, messageId: message.id }, 'Failed to fire webhook');
    }
  }

  async cleanupOldMessages(): Promise<number> {
    try {
      const retentionDaysSetting = await settingsRepository.get('incomingRetentionDays');
      const retentionDays = retentionDaysSetting
        ? parseInt(retentionDaysSetting, 10)
        : env.INCOMING_RETENTION_DAYS;

      logger.info({ retentionDays }, 'Starting incoming messages cleanup job');
      const count = await incomingRepository.deleteOlderThan(retentionDays);
      return count;
    } catch (err) {
      logger.error({ err }, 'Failed to cleanup old incoming messages');
      return 0;
    }
  }
}

export const incomingService = new IncomingService();
