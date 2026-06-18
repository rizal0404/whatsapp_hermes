export type MessageStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'RETRYING'
  | 'EXPIRED';

export type MessageType = 'text' | 'document';

export interface SendTextMessageInput {
  sessionId: string;
  to: string;
  message: string;
  idempotencyKey: string;
}

export interface SendDocumentMessageInput {
  sessionId: string;
  to: string;
  caption?: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  idempotencyKey: string;
}

export interface MessageJobPayload {
  messageId: string;
  sessionId: string;
  to: string;
  type: MessageType;
  text?: string;
  document?: {
    fileUrl: string;
    fileName: string;
    mimeType: string;
    caption?: string;
  };
}
