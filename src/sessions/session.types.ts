export type SessionStatus =
  | 'INITIALIZING'
  | 'REQUIRES_QR'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'RECONNECTING'
  | 'LOGGED_OUT'
  | 'ERROR';

export interface WASessionMetadata {
  sessionId: string;
  label?: string;
  status: SessionStatus;
  phoneNumber?: string;
  lastConnectedAt?: Date;
  lastDisconnectedAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}
