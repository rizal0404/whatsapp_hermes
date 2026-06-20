import { IncomingMessage } from '@prisma/client';
import { logger } from '../common/logger';
import { settingsRepository } from '../settings/settings.repository';
import { env } from '../config/env';

export class IncomingWebhookService {
  async dispatchWebhook(
    url: string,
    event: string,
    message: IncomingMessage
  ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    try {
      logger.debug({ url, messageId: message.id, event }, 'Sending webhook POST');

      const payload = {
        event,
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
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          error: `HTTP error ${response.status}: ${response.statusText}`,
        };
      }

      return { success: true, statusCode: response.status };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Unknown network error',
      };
    }
  }

  async getWebhookUrls(): Promise<string[]> {
    const urls: string[] = [];

    // Get general webhook
    const webhookUrlSetting = await settingsRepository.get('webhookUrl');
    const webhookUrl = webhookUrlSetting || env.WEBHOOK_URL;
    if (webhookUrl && webhookUrl.trim() !== '') {
      urls.push(webhookUrl.trim());
    }

    // Get Hermes webhook
    const hermesUrlSetting = await settingsRepository.get('hermesWebhookUrl');
    const hermesUrl = hermesUrlSetting || env.HERMES_WEBHOOK_URL;
    if (hermesUrl && hermesUrl.trim() !== '') {
      urls.push(hermesUrl.trim());
    }

    return urls;
  }
}

export const incomingWebhookService = new IncomingWebhookService();
export default incomingWebhookService;
