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

describe('Hermes Integration & Recipient Management Routes', () => {
  let app: FastifyInstance;
  const testSessionId = 'hermes-test-session';
  const apiKeyHeaders = { 'x-api-key': env.API_KEY };
  let recipientId1 = '';
  let recipientId2 = '';

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    // Clean up
    await prisma.messageLog.deleteMany({ where: { sessionId: testSessionId } });
    await prisma.messageBatch.deleteMany({ where: { batchKey: { startsWith: `batch_${testSessionId}` } } });
    await prisma.wASession.deleteMany({ where: { sessionId: testSessionId } });
    await prisma.recipient.deleteMany({ where: { name: { startsWith: 'HermesTest' } } });

    // Initialize session to CONNECTED
    const client = await sessionManager.getOrCreateClient(testSessionId, 'Hermes Test Session');
    await client.init();
  });

  afterAll(async () => {
    await prisma.messageLog.deleteMany({ where: { sessionId: testSessionId } });
    await prisma.messageBatch.deleteMany({ where: { batchKey: { startsWith: `batch_${testSessionId}` } } });
    await prisma.wASession.deleteMany({ where: { sessionId: testSessionId } });
    await prisma.recipient.deleteMany({ where: { name: { startsWith: 'HermesTest' } } });
    await app.close();
    await prisma.$disconnect();
  });

  describe('Recipient Management (CRUD)', () => {
    it('should create a new recipient', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/recipients',
        headers: apiKeyHeaders,
        payload: {
          name: 'HermesTest Person 1',
          to: '085566778899',
          isActive: true,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.to).toBe('6285566778899@s.whatsapp.net'); // Normalized
      expect(body.data.type).toBe('phone');
      recipientId1 = body.data.id;
    });

    it('should create a second recipient (group)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/recipients',
        headers: apiKeyHeaders,
        payload: {
          name: 'HermesTest Group 1',
          to: '120363000000000000@g.us',
          isActive: true,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      recipientId2 = body.data.id;
    });

    it('should list all recipients', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/recipients',
        headers: apiKeyHeaders,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should update a recipient', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/v1/recipients/${recipientId1}`,
        headers: apiKeyHeaders,
        payload: {
          name: 'HermesTest Updated Name 1',
          isActive: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe('HermesTest Updated Name 1');
      expect(body.data.isActive).toBe(false);

      // Re-enable for subsequent resolution test
      await prisma.recipient.update({
        where: { id: recipientId1 },
        data: { isActive: true },
      });
    });
  });

  describe('Hermes Batch Report Sending', () => {
    it('should send report with explicit recipients list', async () => {
      const reportDate = '2026-06-18';
      const response = await app.inject({
        method: 'POST',
        url: '/v1/hermes/send-daily-report',
        headers: apiKeyHeaders,
        payload: {
          reportDate,
          sessionId: testSessionId,
          message: 'Laporan harian klasifikasi',
          recipients: [
            { type: 'phone', to: '6281122334455' },
            { type: 'group', to: '120363000000000123@g.us' },
          ],
          document: {
            fileUrl: 'https://raw.githubusercontent.com/pdf-association/pdf-test-files/master/General/Classic/classic.pdf',
            fileName: 'classic.pdf',
            mimeType: 'application/pdf',
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.batchId).toBeDefined();
      expect(body.data.status).toBe('QUEUED');
      expect(body.data.totalRecipients).toBe(2);

      // Verify batch key duplicate prevention
      const responseDup = await app.inject({
        method: 'POST',
        url: '/v1/hermes/send-daily-report',
        headers: apiKeyHeaders,
        payload: {
          reportDate,
          sessionId: testSessionId,
          message: 'Laporan harian klasifikasi (Duplicate)',
          recipients: [
            { type: 'phone', to: '6281122334455' },
          ],
        },
      });
      const bodyDup = JSON.parse(responseDup.body);
      expect(bodyDup.statusCode).toBeUndefined(); // No error code
      expect(bodyDup.data.batchId).toBe(body.data.batchId); // Same batch returned!
    });

    it('should send report resolving active recipients from gateway DB when recipients list is omitted', async () => {
      const reportDate = '2026-06-19'; // Different date to get new batch
      const response = await app.inject({
        method: 'POST',
        url: '/v1/hermes/send-daily-report',
        headers: apiKeyHeaders,
        payload: {
          reportDate,
          sessionId: testSessionId,
          message: 'Laporan harian gateway db recipients',
          // Omit recipients array
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      // Resolved active recipients from DB (should be at least recipientId1 and recipientId2)
      expect(body.data.totalRecipients).toBeGreaterThanOrEqual(2);

      // Verify batch status endpoint
      const statusResponse = await app.inject({
        method: 'GET',
        url: `/v1/hermes/batch/${body.data.batchId}/status`,
        headers: apiKeyHeaders,
      });
      expect(statusResponse.statusCode).toBe(200);
      const statusBody = JSON.parse(statusResponse.body);
      expect(statusBody.success).toBe(true);
      expect(statusBody.data.batchId).toBe(body.data.batchId);
      expect(statusBody.data.status).toBe('QUEUED');
      expect(statusBody.data.messages.length).toBe(body.data.totalRecipients);
    });
  });
});
