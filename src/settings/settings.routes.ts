import { FastifyInstance } from 'fastify';
import { getSettings, updateSettings } from './settings.controller';

const settingsProperties = {
  incomingRetentionDays: { type: 'integer', minimum: 1, maximum: 365, example: 30, description: 'Number of days to retain incoming messages' },
  webhookUrl: { type: 'string', nullable: true, format: 'uri', example: 'https://api.example.com/webhook', description: 'Webhook URL for incoming messages' },
};

export async function settingsRoutes(fastify: FastifyInstance) {
  // 1. GET /settings
  fastify.get('/settings', {
    schema: {
      summary: 'Get gateway settings',
      description: 'Retrieve current gateway settings, falling back to environment variable defaults if not set in database.',
      tags: ['Settings'],
      security: [{ apiKey: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: settingsProperties,
            },
          },
        },
      },
    },
  }, getSettings);

  // 2. PATCH /settings
  fastify.patch('/settings', {
    schema: {
      summary: 'Update gateway settings',
      description: 'Update gateway settings such as message retention days and webhook URL.',
      tags: ['Settings'],
      security: [{ apiKey: [] }],
      body: {
        type: 'object',
        properties: {
          incomingRetentionDays: { type: 'integer', minimum: 1, maximum: 365, example: 15 },
          webhookUrl: { type: 'string', example: 'https://api.example.com/webhook', description: 'Set to empty string to disable' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: settingsProperties,
            },
          },
        },
      },
    },
  }, updateSettings);
}
