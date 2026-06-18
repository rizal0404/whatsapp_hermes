import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { prisma } from '../database/prisma';
import { sessionManager } from '../sessions/session.manager';
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

describe('Message Routes Integration', () => {
  let app: FastifyInstance;
  const testSessionId = 'msg-test-session';
  const apiKeyHeaders = { 'x-api-key': env.API_KEY };

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // 1. Create a session in DB and set it to CONNECTED using sessionManager
    await prisma.wASession.deleteMany({ where: { sessionId: testSessionId } });
    await prisma.messageLog.deleteMany({ where: { sessionId: testSessionId } });

    // Initialize the active client in memory
    const client = await sessionManager.getOrCreateClient(testSessionId, 'Test Session Message');
    await client.init(); // Sets status to CONNECTED in mock
  });

  afterAll(async () => {
    await prisma.messageLog.deleteMany({ where: { sessionId: testSessionId } });
    await prisma.wASession.deleteMany({ where: { sessionId: testSessionId } });
    await app.close();
    await prisma.$disconnect();
  });

  it('should enqueue a text message successfully', async () => {
    const idempotencyKey = 'idemp-text-12345';
    const response = await app.inject({
      method: 'POST',
      url: '/v1/messages/send-text',
      headers: apiKeyHeaders,
      payload: {
        sessionId: testSessionId,
        to: '6281234567890',
        message: 'Hello, this is a test text message',
        idempotencyKey,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.messageId).toBeDefined();
    expect(body.data.status).toBe('QUEUED');

    // Fetch message status
    const statusResponse = await app.inject({
      method: 'GET',
      url: `/v1/messages/${body.data.messageId}/status`,
      headers: apiKeyHeaders,
    });
    expect(statusResponse.statusCode).toBe(200);
    const statusBody = JSON.parse(statusResponse.body);
    expect(statusBody.data.status).toBe('QUEUED');
  });

  it('should prevent duplicate queueing for same idempotencyKey', async () => {
    const idempotencyKey = 'idemp-text-duplicate';
    
    // First request
    const response1 = await app.inject({
      method: 'POST',
      url: '/v1/messages/send-text',
      headers: apiKeyHeaders,
      payload: {
        sessionId: testSessionId,
        to: '6281234567890',
        message: 'First attempt message',
        idempotencyKey,
      },
    });
    const body1 = JSON.parse(response1.body);

    // Second request
    const response2 = await app.inject({
      method: 'POST',
      url: '/v1/messages/send-text',
      headers: apiKeyHeaders,
      payload: {
        sessionId: testSessionId,
        to: '6281234567890',
        message: 'Second attempt message',
        idempotencyKey,
      },
    });

    expect(response2.statusCode).toBe(200);
    const body2 = JSON.parse(response2.body);
    expect(body2.success).toBe(true);
    expect(body2.data.messageId).toBe(body1.data.messageId); // Must return the same messageId
  });

  it('should reject text message enqueueing with validation errors', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/messages/send-text',
      headers: apiKeyHeaders,
      payload: {
        sessionId: testSessionId,
        to: '',
        message: 'No recipient',
        idempotencyKey: 'idemp-fail-1',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should enqueue a document message successfully', async () => {
    const idempotencyKey = 'idemp-doc-12345';
    const response = await app.inject({
      method: 'POST',
      url: '/v1/messages/send-document',
      headers: apiKeyHeaders,
      payload: {
        sessionId: testSessionId,
        to: '6281234567890',
        caption: 'This is the test document caption',
        fileUrl: 'https://raw.githubusercontent.com/pdf-association/pdf-test-files/master/General/Classic/classic.pdf',
        fileName: 'classic.pdf',
        mimeType: 'application/pdf',
        idempotencyKey,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.messageId).toBeDefined();
    expect(body.data.status).toBe('QUEUED');
  });
});
