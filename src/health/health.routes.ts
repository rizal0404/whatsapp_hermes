import { FastifyInstance } from 'fastify';
import { getHealth } from './health.controller';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', getHealth);
  // Also register with trailing slash just in case
  fastify.get('/health/', getHealth);
}
