export type TriggerType = 'mention' | 'reply' | 'mention_reply';
export type IncomingMessageType = 'text' | 'image' | 'video' | 'document' | 'audio' | 'sticker' | 'other';

export interface IncomingMessageData {
  sessionId: string;
  remoteJid: string;
  senderJid: string;
  senderName: string | null;
  waMessageId: string;
  triggerType: TriggerType;
  messageType: IncomingMessageType;
  content: string | null;
  quotedMessageId: string | null;
  quotedContent: string | null;
  isGroup: boolean;
  groupName: string | null;
  messageTimestamp: Date;
  rawPayload: any;
}

export interface IncomingMessageFilters {
  triggerType?: TriggerType;
  isGroup?: boolean;
  isRead?: boolean;
  page?: number;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
