import { FastifyInstance } from 'fastify';
import { sendDailyReport, getBatchStatus } from './hermes.controller';

export async function hermesRoutes(fastify: FastifyInstance) {
  fastify.post('/hermes/send-daily-report', {
    schema: {
      summary: 'Send daily report',
      description: 'Broadcast a daily report message (and optional document) to all default recipients or a custom recipient list.',
      tags: ['Hermes'],
      security: [{ apiKey: [] }],
      body: {
        type: 'object',
        required: ['reportDate', 'sessionId', 'message'],
        properties: {
          reportDate: { type: 'string', format: 'date', description: 'The date the report covers', example: '2026-06-19' },
          sessionId: { type: 'string', description: 'Session identifier to send from', example: 'session-01' },
          message: { type: 'string', description: 'Report text message body', example: 'Daily sales report for 2026-06-19' },
          recipients: {
            type: 'array',
            description: 'Optional custom list of recipients. If omitted, the default recipient list is used.',
            items: {
              type: 'object',
              required: ['type', 'to'],
              properties: {
                type: { type: 'string', enum: ['phone', 'group'], description: 'Recipient type', example: 'phone' },
                to: { type: 'string', description: 'Phone number or group JID', example: '6281234567890@s.whatsapp.net' },
              },
            },
          },
          document: {
            type: 'object',
            description: 'Optional document attachment to include with the report',
            required: ['fileUrl', 'fileName', 'mimeType'],
            properties: {
              fileUrl: { type: 'string', description: 'Public URL of the document', example: 'https://example.com/report.pdf' },
              fileName: { type: 'string', description: 'Display name for the file', example: 'daily-report-2026-06-19.pdf' },
              mimeType: { type: 'string', description: 'MIME type of the document', example: 'application/pdf' },
            },
          },
        },
      },
      response: {
        200: {
          type: 'object',
          description: 'Batch created and messages queued for delivery',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                batchId: { type: 'string', description: 'Unique batch identifier', example: 'batch_rpt_20260619' },
                totalRecipients: { type: 'integer', description: 'Number of recipients in the batch', example: 12 },
                status: { type: 'string', description: 'Overall batch status', example: 'processing' },
              },
            },
          },
        },
      },
    },
  }, sendDailyReport);

  fastify.get('/hermes/batch/:batchId/status', {
    schema: {
      summary: 'Get batch delivery status',
      description: 'Retrieve the delivery status, counts, and per-message details for a previously created batch.',
      tags: ['Hermes'],
      security: [{ apiKey: [] }],
      params: {
        type: 'object',
        required: ['batchId'],
        properties: {
          batchId: { type: 'string', description: 'Unique batch identifier', example: 'batch_rpt_20260619' },
        },
      },
      response: {
        200: {
          type: 'object',
          description: 'Batch status with per-message breakdown',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                batchId: { type: 'string', description: 'Unique batch identifier', example: 'batch_rpt_20260619' },
                batchKey: { type: 'string', description: 'Batch key identifier', example: 'batch_session-01_2026-06-19' },
                status: { type: 'string', description: 'Overall batch status', example: 'QUEUED' },
                totalMessages: { type: 'integer', description: 'Total messages in this batch', example: 12 },
                successCount: { type: 'integer', description: 'Number of successfully sent messages', example: 10 },
                failedCount: { type: 'integer', description: 'Number of failed messages', example: 2 },
                createdAt: { type: 'string', format: 'date-time', description: 'Timestamp when the batch was created' },
                completedAt: { type: 'string', format: 'date-time', nullable: true, description: 'Timestamp when the batch completed processing' },
                messages: {
                  type: 'array',
                  description: 'Per-message delivery details',
                  items: {
                    type: 'object',
                    properties: {
                      messageId: { type: 'string', example: 'msg_abc123' },
                      to: { type: 'string', example: '6281234567890@s.whatsapp.net' },
                      status: { type: 'string', example: 'sent' },
                      sentAt: { type: 'string', format: 'date-time', nullable: true },
                      error: { type: 'string', nullable: true, example: null },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, getBatchStatus);
}
