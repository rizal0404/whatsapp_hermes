import { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env';
import { UnauthorizedError } from './errors';
import { sendError } from './response';

export const apiKeyAuth = async (request: FastifyRequest, reply: FastifyReply) => {
  // Skip auth for health endpoint
  if (request.url === '/health' || request.url === '/health/') {
    return;
  }

  const apiKey = request.headers['x-api-key'];

  if (!apiKey || apiKey !== env.API_KEY) {
    throw new UnauthorizedError('Invalid or missing API key in X-API-Key header');
  }
};
