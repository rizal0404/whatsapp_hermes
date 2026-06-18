import cors from '@fastify/cors';
import fastify, { FastifyInstance } from 'fastify';
import { apiKeyAuth } from './common/auth.middleware';
import { sendError } from './common/response';
import { healthRoutes } from './health/health.routes';
import { hermesRoutes } from './hermes/hermes.routes';
import { messageRoutes } from './messages/message.routes';
import { recipientRoutes } from './recipients/recipient.routes';
import { sessionRoutes } from './sessions/session.routes';
import { metricsRoutes } from './monitoring/metrics.routes';
import { logger } from './common/logger';

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: false, // We use custom logger
  });

  // Register CORS
  app.register(cors, {
    origin: '*',
  });

  // Security Headers (Helmet-equivalent)
  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('Content-Security-Policy', "default-src 'self'");
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    reply.header('X-DNS-Prefetch-Control', 'off');
    reply.header('X-Download-Options', 'noopen');
    reply.header('X-Permitted-Cross-Domain-Policies', 'none');
    reply.header('X-XSS-Protection', '0');
    return payload;
  });

  // Global Error Handler
  app.setErrorHandler((error, request, reply) => {
    return sendError(reply, error);
  });

  // Log all incoming requests
  app.addHook('onRequest', async (request) => {
    logger.debug({
      method: request.method,
      url: request.url,
      ip: request.ip,
    }, 'Incoming Request');
  });

  // Health check - Open public endpoint
  app.register(healthRoutes);

  // API v1 prefix routes - All routes under here are protected by API key auth hook
  app.register(async (v1) => {
    v1.addHook('preHandler', apiKeyAuth);

    v1.register(sessionRoutes);
    v1.register(messageRoutes);
    v1.register(hermesRoutes);
    v1.register(recipientRoutes);
    v1.register(metricsRoutes);
  }, { prefix: '/v1' });

  return app;
}
export default buildApp;
