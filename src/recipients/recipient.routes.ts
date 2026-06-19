import { FastifyInstance } from 'fastify';
import {
  createRecipient,
  listRecipients,
  getRecipient,
  updateRecipient,
  deleteRecipient,
} from './recipient.controller';

export async function recipientRoutes(fastify: FastifyInstance) {
  fastify.post('/recipients', {
    schema: {
      summary: 'Create a recipient',
      description: 'Add a new recipient to the default broadcast list.',
      tags: ['Recipients'],
      security: [{ apiKey: [] }],
      body: {
        type: 'object',
        required: ['name', 'to'],
        properties: {
          name: { type: 'string', description: 'Display name for the recipient', example: 'Accounting Group' },
          to: { type: 'string', description: 'Phone number or group JID', example: '6281234567890@s.whatsapp.net' },
          isActive: { type: 'boolean', description: 'Whether the recipient is active', default: true },
        },
      },
      response: {
        201: {
          type: 'object',
          description: 'Recipient created successfully',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Unique recipient identifier', example: 'rec_abc123' },
                name: { type: 'string', example: 'Accounting Group' },
                to: { type: 'string', example: '6281234567890@s.whatsapp.net' },
                type: { type: 'string', enum: ['phone', 'group'], description: 'Recipient type', example: 'phone' },
                isActive: { type: 'boolean', example: true },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
    },
  }, createRecipient);

  fastify.get('/recipients', {
    schema: {
      summary: 'List recipients',
      description: 'Retrieve all recipients, optionally filtered by active status.',
      tags: ['Recipients'],
      security: [{ apiKey: [] }],
      querystring: {
        type: 'object',
        properties: {
          active: { type: 'boolean', description: 'Filter by active status' },
        },
      },
      response: {
        200: {
          type: 'object',
          description: 'List of recipients',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: 'rec_abc123' },
                  name: { type: 'string', example: 'Accounting Group' },
                  to: { type: 'string', example: '6281234567890@s.whatsapp.net' },
                  type: { type: 'string', enum: ['phone', 'group'], description: 'Recipient type', example: 'phone' },
                  isActive: { type: 'boolean', example: true },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
  }, listRecipients);

  fastify.get('/recipients/:id', {
    schema: {
      summary: 'Get a recipient',
      description: 'Retrieve a single recipient by its unique identifier.',
      tags: ['Recipients'],
      security: [{ apiKey: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Recipient identifier', example: 'rec_abc123' },
        },
      },
      response: {
        200: {
          type: 'object',
          description: 'Recipient details',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'rec_abc123' },
                name: { type: 'string', example: 'Accounting Group' },
                to: { type: 'string', example: '6281234567890@s.whatsapp.net' },
                type: { type: 'string', enum: ['phone', 'group'], description: 'Recipient type', example: 'phone' },
                isActive: { type: 'boolean', example: true },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
    },
  }, getRecipient);

  fastify.put('/recipients/:id', {
    schema: {
      summary: 'Update a recipient',
      description: 'Update one or more fields of an existing recipient.',
      tags: ['Recipients'],
      security: [{ apiKey: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Recipient identifier', example: 'rec_abc123' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Updated display name', example: 'Finance Group' },
          to: { type: 'string', description: 'Updated phone number or group JID', example: '6289876543210@s.whatsapp.net' },
          isActive: { type: 'boolean', description: 'Updated active status', example: false },
        },
      },
      response: {
        200: {
          type: 'object',
          description: 'Recipient updated successfully',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'rec_abc123' },
                name: { type: 'string', example: 'Finance Group' },
                to: { type: 'string', example: '6289876543210@s.whatsapp.net' },
                type: { type: 'string', enum: ['phone', 'group'], description: 'Recipient type', example: 'phone' },
                isActive: { type: 'boolean', example: false },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
    },
  }, updateRecipient);

  fastify.delete('/recipients/:id', {
    schema: {
      summary: 'Delete a recipient',
      description: 'Permanently remove a recipient from the broadcast list.',
      tags: ['Recipients'],
      security: [{ apiKey: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Recipient identifier', example: 'rec_abc123' },
        },
      },
      response: {
        204: {
          type: 'null',
          description: 'Recipient deleted successfully',
        },
      },
    },
  }, deleteRecipient);
}
