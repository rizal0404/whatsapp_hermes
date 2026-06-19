export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_NOT_CONNECTED'
  | 'DUPLICATE_IDEMPOTENCY_KEY'
  | 'FILE_DOWNLOAD_FAILED'
  | 'MESSAGE_SEND_FAILED'
  | 'QUEUE_ERROR'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly isAppError = true;
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details: Record<string, any> = {}
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details: Record<string, any> = {}) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized access') {
    super('UNAUTHORIZED', message, 401);
  }
}

export class SessionNotFoundError extends AppError {
  constructor(sessionId: string) {
    super('SESSION_NOT_FOUND', `Session '${sessionId}' not found`, 404, { sessionId });
  }
}

export class SessionNotConnectedError extends AppError {
  constructor(sessionId: string, currentStatus: string) {
    super('SESSION_NOT_CONNECTED', 'WhatsApp session not connected. Please scan QR first.', 400, {
      sessionId,
      currentStatus,
    });
  }
}

export class DuplicateIdempotencyKeyError extends AppError {
  constructor(idempotencyKey: string) {
    super('DUPLICATE_IDEMPOTENCY_KEY', `Duplicate request for idempotency key '${idempotencyKey}'`, 409, {
      idempotencyKey,
    });
  }
}

export class FileDownloadError extends AppError {
  constructor(message: string, details: Record<string, any> = {}) {
    super('FILE_DOWNLOAD_FAILED', message, 400, details);
  }
}

export class MessageSendError extends AppError {
  constructor(message: string, details: Record<string, any> = {}) {
    super('MESSAGE_SEND_FAILED', message, 500, details);
  }
}
