import { z } from 'zod';

export const hermesRecipientSchema = z.object({
  type: z.enum(['phone', 'group']),
  to: z.string().min(1, 'to (number or JID) is required'),
});

export const hermesSendDailyReportSchema = z.object({
  reportDate: z.string().min(1, 'reportDate is required'),
  sessionId: z.string().min(1, 'sessionId is required'),
  message: z.string().min(1, 'message text is required'),
  recipients: z.array(hermesRecipientSchema).optional(),
  document: z
    .object({
      fileUrl: z.string().url('document.fileUrl must be a valid URL'),
      fileName: z.string().min(1, 'document.fileName is required'),
      mimeType: z.string().min(1, 'document.mimeType is required'),
    })
    .optional(),
});

export type HermesRecipient = z.infer<typeof hermesRecipientSchema>;
export type HermesSendDailyReportInput = z.infer<typeof hermesSendDailyReportSchema>;
