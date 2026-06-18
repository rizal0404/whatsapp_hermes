import { FastifyInstance } from 'fastify';
import { getMetrics } from './metrics.controller';

export async function metricsRoutes(fastify: FastifyInstance) {
  fastify.get('/metrics', getMetrics);
}
