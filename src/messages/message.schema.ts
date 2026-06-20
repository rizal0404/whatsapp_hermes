import { z } from 'zod';

export const sendTextMessageSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  to: z.string().min(1, 'recipient phone or group JID is required'),
  message: z.string().min(1, 'message body is required'),
  idempotencyKey: z.string().min(1, 'idempotencyKey is required'),
  replyToMessageId: z.string().optional(),
});

export const sendDocumentMessageSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  to: z.string().min(1, 'recipient phone or group JID is required'),
  caption: z.string().optional(),
  fileUrl: z.string().url('fileUrl must be a valid URL'),
  fileName: z.string().min(1, 'fileName is required'),
  mimeType: z.string().min(1, 'mimeType is required'),
  idempotencyKey: z.string().min(1, 'idempotencyKey is required'),
  replyToMessageId: z.string().optional(),
});
