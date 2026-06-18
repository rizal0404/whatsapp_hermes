import { FastifyInstance } from 'fastify';
import { sendDailyReport, getBatchStatus } from './hermes.controller';

export async function hermesRoutes(fastify: FastifyInstance) {
  fastify.post('/hermes/send-daily-report', sendDailyReport);
  fastify.get('/hermes/batch/:batchId/status', getBatchStatus);
}
