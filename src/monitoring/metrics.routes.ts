import { FastifyInstance } from 'fastify';
import { getMetrics } from './metrics.controller';

const getMetricsSchema = {
  summary: 'System metrics',
  description: 'Returns current system metrics including active sessions, message throughput, and queue statistics.',
  tags: ['Monitoring'],
  security: [{ apiKey: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            sessions: {
              type: 'object',
              properties: {
                total: { type: 'integer', example: 12 },
                active: { type: 'integer', example: 5 },
                disconnected: { type: 'integer', example: 7 },
              },
            },
            messages: {
              type: 'object',
              properties: {
                queued: { type: 'integer', example: 0 },
                processing: { type: 'integer', example: 0 },
                sent: { type: 'integer', example: 1520 },
                failed: { type: 'integer', example: 3 },
                retrying: { type: 'integer', example: 0 },
                expired: { type: 'integer', example: 0 },
                totalRetryCount: { type: 'integer', example: 2 },
              },
            },
            queue: {
              type: 'object',
              properties: {
                waiting: { type: 'integer', example: 42 },
                active: { type: 'integer', example: 5 },
                delayed: { type: 'integer', example: 0 },
                failed: { type: 'integer', example: 7 },
                completed: { type: 'integer', example: 9800 },
              },
            },
          },
        },
      },
    },
  },
};

export async function metricsRoutes(fastify: FastifyInstance) {
  fastify.get('/metrics', { schema: getMetricsSchema }, getMetrics);
}
