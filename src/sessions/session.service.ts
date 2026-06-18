import { sessionManager } from './session.manager';
import { sessionRepository } from './session.repository';
import { SessionNotFoundError, ValidationError } from '../common/errors';
import { WASession } from '@prisma/client';
import { SessionStatus } from './session.types';
import { auditLogger } from '../common/audit.logger';

export class SessionService {
  async createSession(sessionId: string, label?: string): Promise<WASession> {
    if (!sessionId || sessionId.trim() === '') {
      throw new ValidationError('sessionId is required and cannot be empty');
    }

    const existing = await sessionRepository.findBySessionId(sessionId);
    if (existing && existing.status !== 'LOGGED_OUT') {
      throw new ValidationError(`Session with ID '${sessionId}' already exists and is active`);
    }

    // Start or re-start the session
    const client = await sessionManager.getOrCreateClient(sessionId, label);
    
    // Retrieve the DB state (since getOrCreateClient creates it if not exists)
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new Error('Failed to retrieve created session');
    }

    // Audit log
    await auditLogger.log({
      action: 'SESSION_CREATE',
      entityType: 'WASession',
      entityId: sessionId,
      metadata: { label },
    });

    return session;
  }

  async getSessionStatus(sessionId: string) {
    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    // Ensure it is running if not logged out
    if (session.status !== 'LOGGED_OUT') {
      await sessionManager.getOrCreateClient(sessionId);
    }

    return session;
  }

  async getSessionQr(sessionId: string) {
    const session = await this.getSessionStatus(sessionId);
    
    if (session.status === 'CONNECTED') {
      return {
        sessionId,
        status: 'CONNECTED' as SessionStatus,
        qr: null,
      };
    }

    // Retrieve active client
    try {
      const client = sessionManager.getClient(sessionId);
      const qr = client.getQrCode();
      return {
        sessionId,
        status: session.status as SessionStatus,
        qr,
        expiresInSeconds: 30, // Default TTL
      };
    } catch (err) {
      return {
        sessionId,
        status: session.status as SessionStatus,
        qr: null,
      };
    }
  }

  async logoutSession(sessionId: string): Promise<WASession> {
    // This will disconnect Baileys, clean folder, update status
    await sessionManager.logoutSession(sessionId);

    const session = await sessionRepository.findBySessionId(sessionId);
    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    // Audit log
    await auditLogger.log({
      action: 'SESSION_LOGOUT',
      entityType: 'WASession',
      entityId: sessionId,
    });

    return session;
  }

  async listSessions(): Promise<WASession[]> {
    return sessionRepository.listAll();
  }
}

export const sessionService = new SessionService();
