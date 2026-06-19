import { FastifyInstance } from 'fastify';
import {
  createSession,
  getSessionStatus,
  getSessionQr,
  logoutSession,
  listSessions,
} from './session.controller';

const sessionIdParam = {
  type: 'object',
  required: ['sessionId'],
  properties: {
    sessionId: { type: 'string', description: 'Unique session identifier', example: 'session-01' },
  },
};

const security = [{ apiKey: [] }];

const createSessionSchema = {
  summary: 'Create a new session',
  description: 'Initializes a new WhatsApp session. Returns the created session details.',
  tags: ['Sessions'],
  security,
  body: {
    type: 'object',
    required: ['sessionId'],
    properties: {
      sessionId: { type: 'string', description: 'Unique identifier for the new session', example: 'session-01' },
      label: { type: 'string', description: 'Optional human-readable label', example: 'Marketing Bot' },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', example: 'session-01' },
            label: { type: 'string', example: 'Marketing Bot' },
            status: { type: 'string', example: 'created' },
          },
        },
      },
    },
  },
};

const listSessionsSchema = {
  summary: 'List all sessions',
  description: 'Returns a list of all registered WhatsApp sessions with their current status.',
  tags: ['Sessions'],
  security,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sessionId: { type: 'string', example: 'session-01' },
              label: { type: 'string', example: 'Marketing Bot' },
              status: { type: 'string', enum: ['connected', 'disconnected', 'connecting', 'created'], example: 'connected' },
              phoneNumber: { type: 'string', example: '628123456789' },
            },
          },
        },
      },
    },
  },
};

const getSessionStatusSchema = {
  summary: 'Get session status',
  description: 'Returns the current status and details of a specific WhatsApp session.',
  tags: ['Sessions'],
  security,
  params: sessionIdParam,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', example: 'session-01' },
            label: { type: 'string', example: 'Marketing Bot' },
            status: { type: 'string', enum: ['connected', 'disconnected', 'connecting', 'created'], example: 'connected' },
            phoneNumber: { type: 'string', example: '628123456789' },
          },
        },
      },
    },
    404: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: { type: 'string', example: 'Session not found' },
      },
    },
  },
};

const getSessionQrSchema = {
  summary: 'Get session QR code',
  description: 'Returns a base64-encoded QR code image for pairing the WhatsApp session.',
  tags: ['Sessions'],
  security,
  params: sessionIdParam,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', example: 'session-01' },
            status: { type: 'string', example: 'REQUIRES_QR' },
            qr: { type: 'string', description: 'Base64-encoded QR code image', example: 'data:image/png;base64,iVBOR...' },
            expiresInSeconds: { type: 'integer', example: 30 },
          },
        },
      },
    },
    404: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: { type: 'string', example: 'Session not found or QR not available' },
      },
    },
  },
};

const logoutSessionSchema = {
  summary: 'Logout a session',
  description: 'Disconnects and logs out a specific WhatsApp session, clearing its authentication state.',
  tags: ['Sessions'],
  security,
  params: sessionIdParam,
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', example: 'session-01' },
            status: { type: 'string', example: 'logged_out' },
          },
        },
      },
    },
    404: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        error: { type: 'string', example: 'Session not found' },
      },
    },
  },
};

export async function sessionRoutes(fastify: FastifyInstance) {
  fastify.post('/sessions', { schema: createSessionSchema }, createSession);
  fastify.get('/sessions', { schema: listSessionsSchema }, listSessions);
  fastify.get('/sessions/:sessionId/status', { schema: getSessionStatusSchema }, getSessionStatus);
  fastify.get('/sessions/:sessionId/qr', { schema: getSessionQrSchema }, getSessionQr);
  fastify.post('/sessions/:sessionId/logout', { schema: logoutSessionSchema }, logoutSession);
}
