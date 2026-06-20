import { FastifyInstance } from 'fastify';
import { sendText, sendDocument, getMessageStatus } from './message.controller';

export async function messageRoutes(fastify: FastifyInstance) {
  fastify.post('/messages/send-text', {
    schema: {
      summary: 'Send a text message',
      description: 'Send a text message to a WhatsApp number or group via the specified session.',
      tags: ['Messages'],
      security: [{ apiKey: [] }],
      body: {
        type: 'object',
        required: ['sessionId', 'to', 'message', 'idempotencyKey'],
        properties: {
          sessionId: { type: 'string', description: 'Session identifier', example: 'session-01' },
          to: { type: 'string', description: 'Recipient phone number or group JID', example: '6281234567890@s.whatsapp.net' },
          message: { type: 'string', description: 'Text message content', example: 'Hello from Hermes!' },
          idempotencyKey: { type: 'string', description: 'Unique key to prevent duplicate sends', example: '550e8400-e29b-41d4-a716-446655440000' },
          replyToMessageId: { type: 'string', description: 'Optional ID of the message to quote/reply to', example: '3EB0A1B2C3D4E5F7' },
        },
      },
      response: {
        200: {
          type: 'object',
          description: 'Message accepted for delivery',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                messageId: { type: 'string', description: 'Unique message identifier', example: 'msg_abc123' },
                status: { type: 'string', description: 'Current message status', example: 'queued' },
              },
            },
          },
        },
      },
    },
  }, sendText);

  fastify.post('/messages/send-document', {
    schema: {
      summary: 'Send a document message',
      description: 'Send a document (PDF, image, etc.) to a WhatsApp number or group via the specified session.',
      tags: ['Messages'],
      security: [{ apiKey: [] }],
      body: {
        type: 'object',
        required: ['sessionId', 'to', 'fileUrl', 'fileName', 'mimeType', 'idempotencyKey'],
        properties: {
          sessionId: { type: 'string', description: 'Session identifier', example: 'session-01' },
          to: { type: 'string', description: 'Recipient phone number or group JID', example: '6281234567890@s.whatsapp.net' },
          fileUrl: { type: 'string', description: 'Public URL of the document to send', example: 'https://example.com/report.pdf' },
          fileName: { type: 'string', description: 'Display name for the file', example: 'report.pdf' },
          mimeType: { type: 'string', description: 'MIME type of the document', example: 'application/pdf' },
          caption: { type: 'string', description: 'Optional caption for the document', example: 'Monthly report' },
          idempotencyKey: { type: 'string', description: 'Unique key to prevent duplicate sends', example: '550e8400-e29b-41d4-a716-446655440001' },
          replyToMessageId: { type: 'string', description: 'Optional ID of the message to quote/reply to', example: '3EB0A1B2C3D4E5F7' },
        },
      },
      response: {
        200: {
          type: 'object',
          description: 'Document message accepted for delivery',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                messageId: { type: 'string', description: 'Unique message identifier', example: 'msg_doc456' },
                status: { type: 'string', description: 'Current message status', example: 'queued' },
              },
            },
          },
        },
      },
    },
  }, sendDocument);

  fastify.get('/messages/:messageId/status', {
    schema: {
      summary: 'Get message delivery status',
      description: 'Retrieve the current delivery status and metadata of a previously sent message.',
      tags: ['Messages'],
      security: [{ apiKey: [] }],
      params: {
        type: 'object',
        required: ['messageId'],
        properties: {
          messageId: { type: 'string', description: 'Unique message identifier', example: 'msg_abc123' },
        },
      },
      response: {
        200: {
          type: 'object',
          description: 'Message status details',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                messageId: { type: 'string', description: 'Unique message identifier', example: 'msg_abc123' },
                status: { type: 'string', description: 'Delivery status', example: 'sent' },
                sessionId: { type: 'string', description: 'Session used for delivery', example: 'session-01' },
                to: { type: 'string', description: 'Recipient address', example: '6281234567890@s.whatsapp.net' },
                attempt: { type: 'integer', description: 'Number of delivery attempts', example: 1 },
                lastError: { type: 'string', nullable: true, description: 'Last error message if delivery failed', example: null },
                createdAt: { type: 'string', format: 'date-time', description: 'Timestamp when the message was created' },
                sentAt: { type: 'string', format: 'date-time', nullable: true, description: 'Timestamp when the message was successfully sent' },
              },
            },
          },
        },
      },
    },
  }, getMessageStatus);
}
