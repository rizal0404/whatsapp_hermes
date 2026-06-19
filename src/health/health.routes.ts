import { FastifyInstance } from 'fastify';
import { getHealth } from './health.controller';

const healthResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: {
      type: 'object',
      properties: {
        service: { type: 'string', example: 'whatsapp-api' },
        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'], example: 'healthy' },
        database: { type: 'string', enum: ['connected', 'disconnected'], example: 'connected' },
        redis: { type: 'string', enum: ['connected', 'disconnected'], example: 'connected' },
        uptimeSeconds: { type: 'number', example: 3600 },
      },
    },
  },
};

const healthSchema = {
  summary: 'Health check',
  description: 'Returns the current health status of the service, including database and Redis connectivity and uptime.',
  tags: ['Health'],
  response: {
    200: healthResponseSchema,
  },
};

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', { schema: healthSchema }, getHealth);
  // Also register with trailing slash just in case
  fastify.get('/health/', { schema: healthSchema }, getHealth);
}
