import { FastifyInstance } from 'fastify';
import { listGroups, getGroupDetail } from './group.controller';

export async function groupRoutes(fastify: FastifyInstance) {
  fastify.get('/groups/:sessionId', {
    schema: {
      summary: 'List all WhatsApp groups',
      description: 'Retrieves all WhatsApp groups that the specified session has joined. Returns group JID, name, participant count, and creation timestamp.',
      tags: ['Groups'],
      params: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: { type: 'string', description: 'The session ID to fetch groups for' },
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
                sessionId: { type: 'string', example: 'my-session' },
                totalGroups: { type: 'number', example: 5 },
                groups: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      jid: { type: 'string', example: '120363071378877140@g.us' },
                      subject: { type: 'string', example: 'My Group Chat' },
                      participantCount: { type: 'number', example: 25 },
                      creation: { type: 'number', example: 1718700000 },
                    },
                  },
                },
              },
            },
          },
        },
      },
      security: [{ apiKey: [] }],
    },
  }, listGroups);

  fastify.get('/groups/:sessionId/:groupJid', {
    schema: {
      summary: 'Get group detail',
      description: 'Retrieves detailed metadata for a specific WhatsApp group including participant list, admins, description, and owner.',
      tags: ['Groups'],
      params: {
        type: 'object',
        required: ['sessionId', 'groupJid'],
        properties: {
          sessionId: { type: 'string', description: 'The session ID' },
          groupJid: { type: 'string', description: 'The group JID (e.g., 120363071378877140@g.us or just the numeric part)' },
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
                jid: { type: 'string', example: '120363071378877140@g.us' },
                subject: { type: 'string', example: 'My Group Chat' },
                description: { type: 'string', nullable: true, example: 'Group description text' },
                owner: { type: 'string', example: '6281234567890@s.whatsapp.net' },
                creation: { type: 'number', example: 1718700000 },
                participantCount: { type: 'number', example: 25 },
                participants: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      jid: { type: 'string', example: '6281234567890@s.whatsapp.net' },
                      admin: { type: 'string', nullable: true, example: 'admin' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      security: [{ apiKey: [] }],
    },
  }, getGroupDetail);
}
