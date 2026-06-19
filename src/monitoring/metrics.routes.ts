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
                active: { type: 'number', example: 5 },
                total: { type: 'number', example: 12 },
              },
            },
            messages: {
              type: 'object',
              properties: {
                sent: { type: 'number', example: 1520 },
                received: { type: 'number', example: 3200 },
                failed: { type: 'number', example: 3 },
              },
            },
            queue: {
              type: 'object',
              properties: {
                pending: { type: 'number', example: 42 },
                processing: { type: 'number', example: 5 },
                completed: { type: 'number', example: 9800 },
                failed: { type: 'number', example: 7 },
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
