import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { prisma } from '../database/prisma';
import { env } from '../config/env';

// Unified Dynamic Mock for BaileysClient to prevent cross-test conflicts in Vitest shared process
vi.mock('../whatsapp/baileys.client', () => {
  return {
    BaileysClient: class {
      public sessionId: string;
      private onStatusChange: (status: string, extra?: any) => Promise<void>;
      private qrCode: string | null = 'mock-qr-code-base64';
      public socket: any = {
        sendMessage: vi.fn().mockResolvedValue({ key: { id: 'mock-msg-id-123' } }),
      };

      constructor(sessionId: string, onStatusChange: (status: string, extra?: any) => Promise<void>) {
        this.sessionId = sessionId;
        this.onStatusChange = onStatusChange;
      }

      public getQrCode() {
        return this.qrCode;
      }

      public async init() {
        if (this.sessionId.startsWith('hermes-') || this.sessionId.startsWith('msg-')) {
          await this.onStatusChange('CONNECTED', { phoneNumber: '6281234567890' });
        } else {
          // For session tests, run async transition to REQUIRES_QR in next tick
          setImmediate(async () => {
            try {
              await this.onStatusChange('REQUIRES_QR', { qr: this.qrCode });
            } catch (err) {
              // Ignore record not found errors from afterAll cleanups
            }
          });
        }
      }

      public async logout() {
        this.qrCode = null;
        await this.onStatusChange('LOGGED_OUT');
      }

      public async close() {}
    },
  };
});

describe('Session Routes Integration', () => {
  let app: FastifyInstance;
  const testSessionId = 'test-session-123';
  const apiKeyHeaders = { 'x-api-key': env.API_KEY };

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    // Clean up any left overs
    try {
      await prisma.wASession.deleteMany({ where: { sessionId: testSessionId } });
    } catch {}
  });

  afterAll(async () => {
    try {
      await prisma.wASession.deleteMany({ where: { sessionId: testSessionId } });
    } catch {}
    await app.close();
    await prisma.$disconnect();
  });

  it('should create a new session successfully', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/sessions',
      headers: apiKeyHeaders,
      payload: {
        sessionId: testSessionId,
        label: 'Test Session Label',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.sessionId).toBe(testSessionId);
    expect(body.data.status).toBe('INITIALIZING');

    // Poll the database to wait for the mock init to update the status to 'REQUIRES_QR'
    let dbSession: any = null;
    for (let i = 0; i < 20; i++) {
      dbSession = await prisma.wASession.findUnique({
        where: { sessionId: testSessionId },
      });
      if (dbSession && dbSession.status === 'REQUIRES_QR') {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    expect(dbSession).toBeDefined();
    expect(dbSession?.status).toBe('REQUIRES_QR');
  });

  it('should list all sessions', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/sessions',
      headers: apiKeyHeaders,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    const session = body.data.find((s: any) => s.sessionId === testSessionId);
    expect(session).toBeDefined();
    expect(session.label).toBe('Test Session Label');
  });

  it('should return session connection status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/v1/sessions/${testSessionId}/status`,
      headers: apiKeyHeaders,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.sessionId).toBe(testSessionId);
    expect(body.data.status).toBe('REQUIRES_QR');
  });

  it('should return QR code if session requires QR', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/v1/sessions/${testSessionId}/qr`,
      headers: apiKeyHeaders,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.sessionId).toBe(testSessionId);
    expect(body.data.status).toBe('REQUIRES_QR');
    expect(body.data.qr).toBe('mock-qr-code-base64');
  });

  it('should logout session successfully', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/v1/sessions/${testSessionId}/logout`,
      headers: apiKeyHeaders,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.sessionId).toBe(testSessionId);
    expect(body.data.status).toBe('LOGGED_OUT');

    // Confirm DB reflects LOGGED_OUT status
    const dbSession = await prisma.wASession.findUnique({
      where: { sessionId: testSessionId },
    });
    expect(dbSession?.status).toBe('LOGGED_OUT');
  });
});
