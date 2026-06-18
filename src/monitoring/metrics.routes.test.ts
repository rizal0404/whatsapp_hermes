import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { prisma } from '../database/prisma';
import { env } from '../config/env';

describe('Metrics Route Integration', () => {
  let app: FastifyInstance;
  const apiKeyHeaders = { 'x-api-key': env.API_KEY };

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('should return metrics summary successfully', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/metrics',
      headers: apiKeyHeaders,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    
    // Check structure
    expect(body.data.sessions).toBeDefined();
    expect(body.data.sessions.total).toBeDefined();
    expect(body.data.sessions.active).toBeDefined();
    
    expect(body.data.messages).toBeDefined();
    expect(body.data.messages.queued).toBeDefined();
    expect(body.data.messages.sent).toBeDefined();
    
    expect(body.data.queue).toBeDefined();
    expect(body.data.queue.waiting).toBeDefined();
    expect(body.data.queue.active).toBeDefined();
  });
});
