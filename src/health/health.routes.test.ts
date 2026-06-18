import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { prisma } from '../database/prisma';
import { env } from '../config/env';

describe('Health Check Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('should return health check details', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.service).toBe('wa-gateway');
    expect(body.data.status).toBe('OK');
    expect(body.data.database).toBe('OK');
    expect(body.data.redis).toBe('OK');
    expect(typeof body.data.uptimeSeconds).toBe('number');
  });

  it('should reject requests to protected v1 routes without API key', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      payload: {},
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('should allow requests to protected v1 routes with correct API key', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions',
      headers: {
        'x-api-key': env.API_KEY,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
  });
});
