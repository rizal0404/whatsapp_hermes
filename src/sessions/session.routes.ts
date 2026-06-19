import { FastifyInstance } from 'fastify';
import {
  createSession,
  getSessionStatus,
  getSessionQr,
  getSessionQrPage,
  logoutSession,
  listSessions,
} from './session.controller';

export async function sessionRoutes(fastify: FastifyInstance) {
  fastify.post('/sessions', createSession);
  fastify.get('/sessions', listSessions);
  fastify.get('/sessions/:sessionId/status', getSessionStatus);
  fastify.get('/sessions/:sessionId/qr', getSessionQr);
  fastify.get('/sessions/:sessionId/qr-page', getSessionQrPage);
  fastify.post('/sessions/:sessionId/logout', logoutSession);
}
