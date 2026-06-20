import { FastifyInstance } from 'fastify';
import {
  listMessages,
  getUnreadCount,
  markAllAsRead,
  getMessage,
  markAsRead,
} from './incoming.controller';

const messageProperties = {
  id: { type: 'string', format: 'uuid', example: 'd3b07384-d113-4ec5-a5af-7657d4a23a31' },
  sessionId: { type: 'string', example: 'session-01' },
  remoteJid: { type: 'string', example: '1203630423456789@g.us' },
  senderJid: { type: 'string', example: '628123456789@s.whatsapp.net' },
  senderName: { type: 'string', nullable: true, example: 'John Doe' },
  waMessageId: { type: 'string', example: '3EB0A1B2C3D4E5F6' },
  triggerType: { type: 'string', enum: ['mention', 'reply', 'mention_reply'], example: 'mention' },
  messageType: { type: 'string', enum: ['text', 'image', 'video', 'document', 'audio', 'sticker', 'other'], example: 'text' },
  content: { type: 'string', nullable: true, example: 'Hello @62899999999' },
  quotedMessageId: { type: 'string', nullable: true, example: '3EB0A1B2C3D4E5F7' },
  quotedContent: { type: 'string', nullable: true, example: 'Original message text' },
  isGroup: { type: 'boolean', example: true },
  groupName: { type: 'string', nullable: true, example: 'My Group' },
  isRead: { type: 'boolean', example: false },
  messageTimestamp: { type: 'string', format: 'date-time' },
  createdAt: { type: 'string', format: 'date-time' },
  updatedAt: { type: 'string', format: 'date-time' },
};

export async function incomingRoutes(fastify: FastifyInstance) {
  // 1. GET /incoming/:sessionId (list)
  fastify.get('/incoming/:sessionId', {
    schema: {
      summary: 'List incoming mention/reply messages',
      description: 'Retrieve incoming messages where the user was mentioned or replied to, with pagination and filters.',
      tags: ['Incoming'],
      security: [{ apiKey: [] }],
      params: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: { type: 'string', description: 'Session identifier' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          triggerType: { type: 'string', enum: ['mention', 'reply', 'mention_reply'], description: 'Filter by trigger type' },
          isGroup: { type: 'boolean', description: 'Filter by group vs private chat' },
          isRead: { type: 'boolean', description: 'Filter by read status' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                sessionId: { type: 'string', example: 'session-01' },
                messages: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: messageProperties, // List doesn't include rawPayload to keep response lightweight
                  },
                },
                pagination: {
                  type: 'object',
                  properties: {
                    page: { type: 'integer', example: 1 },
                    limit: { type: 'integer', example: 20 },
                    total: { type: 'integer', example: 50 },
                    totalPages: { type: 'integer', example: 3 },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, listMessages);

  // 2. GET /incoming/:sessionId/unread-count
  fastify.get('/incoming/:sessionId/unread-count', {
    schema: {
      summary: 'Get unread message count',
      description: 'Get the number of unread mention/reply messages for a session.',
      tags: ['Incoming'],
      security: [{ apiKey: [] }],
      params: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: { type: 'string', description: 'Session identifier' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                sessionId: { type: 'string', example: 'session-01' },
                unreadCount: { type: 'integer', example: 5 },
              },
            },
          },
        },
      },
    },
  }, getUnreadCount);

  // 3. PATCH /incoming/:sessionId/read-all
  fastify.patch('/incoming/:sessionId/read-all', {
    schema: {
      summary: 'Mark all messages as read',
      description: 'Mark all incoming messages for this session as read.',
      tags: ['Incoming'],
      security: [{ apiKey: [] }],
      params: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: { type: 'string', description: 'Session identifier' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                sessionId: { type: 'string', example: 'session-01' },
                updatedCount: { type: 'integer', example: 5 },
              },
            },
          },
        },
      },
    },
  }, markAllAsRead);

  // 4. GET /incoming/:sessionId/:messageId
  fastify.get('/incoming/:sessionId/:messageId', {
    schema: {
      summary: 'Get a single incoming message',
      description: 'Retrieve details of a single incoming message, including the raw Baileys payload.',
      tags: ['Incoming'],
      security: [{ apiKey: [] }],
      params: {
        type: 'object',
        required: ['sessionId', 'messageId'],
        properties: {
          sessionId: { type: 'string', description: 'Session identifier' },
          messageId: { type: 'string', description: 'Message database ID (UUID)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                ...messageProperties,
                rawPayload: { type: 'object', additionalProperties: true, nullable: true }, // rawPayload included in single get
              },
            },
          },
        },
      },
    },
  }, getMessage);

  // 5. PATCH /incoming/:sessionId/:messageId/read
  fastify.patch('/incoming/:sessionId/:messageId/read', {
    schema: {
      summary: 'Mark message as read',
      description: 'Mark a single incoming message as read.',
      tags: ['Incoming'],
      security: [{ apiKey: [] }],
      params: {
        type: 'object',
        required: ['sessionId', 'messageId'],
        properties: {
          sessionId: { type: 'string', description: 'Session identifier' },
          messageId: { type: 'string', description: 'Message database ID (UUID)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: messageProperties,
            },
          },
        },
      },
    },
  }, markAsRead);
}
