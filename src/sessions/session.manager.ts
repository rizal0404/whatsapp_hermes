import { BaileysClient } from '../whatsapp/baileys.client';
import { sessionRepository } from './session.repository';
import { SessionStatus } from './session.types';
import { logger } from '../common/logger';
import { WASession } from '@prisma/client';
import { SessionNotFoundError } from '../common/errors';
import { incomingService } from '../incoming/incoming.service';

export class SessionManager {
  private activeClients = new Map<string, BaileysClient>();

  public async initAllSessions(): Promise<void> {
    try {
      const sessions = await sessionRepository.listAll();
      logger.info(`Restoring WhatsApp sessions... Found ${sessions.length} sessions in database.`);

      for (const session of sessions) {
        // We restore session if it was not explicitly logged out
        if (session.status !== 'LOGGED_OUT') {
          logger.info({ sessionId: session.sessionId }, 'Restoring active WhatsApp session');
          await this.getOrCreateClient(session.sessionId);
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to restore sessions on startup');
    }
  }

  public async getOrCreateClient(sessionId: string, label?: string): Promise<BaileysClient> {
    // Check in-memory cache
    let client = this.activeClients.get(sessionId);
    if (client) {
      return client;
    }

    // Check database
    let dbSession = await sessionRepository.findBySessionId(sessionId);
    if (!dbSession) {
      dbSession = await sessionRepository.create(sessionId, label);
      logger.info({ sessionId }, 'Created new session entry in database');
    }

    // Instantiate client
    client = new BaileysClient(sessionId, async (status: SessionStatus, extra: any = {}) => {
      const eventMap: Record<SessionStatus, string> = {
        INITIALIZING: 'session.created',
        REQUIRES_QR: 'session.qr_generated',
        CONNECTED: 'session.connected',
        DISCONNECTED: 'session.disconnected',
        RECONNECTING: 'session.reconnecting',
        LOGGED_OUT: 'session.logged_out',
        ERROR: 'session.error',
      };
      const event = eventMap[status] || 'session.status_updated';
      logger.info({ sessionId, event, status, ...extra }, `WhatsApp session status: ${status}`);
      
      try {
        await sessionRepository.updateStatus(sessionId, status, {
          phoneNumber: extra.phoneNumber,
          lastConnectedAt: extra.lastConnectedAt,
          lastDisconnectedAt: extra.lastDisconnectedAt,
          lastError: extra.lastError || null,
        });
      } catch (err) {
        logger.error({ err, sessionId, status }, 'Failed to save updated session status to database');
      }

      if (status === 'LOGGED_OUT') {
        this.activeClients.delete(sessionId);
      }
    });

    // Wire incoming message callback
    client.setIncomingMessageHandler(async (msgData) => {
      await incomingService.saveIncomingMessage(msgData);
    });

    this.activeClients.set(sessionId, client);
    
    // Do not block waiting for connection init
    client.init();

    return client;
  }

  public getClient(sessionId: string): BaileysClient {
    const client = this.activeClients.get(sessionId);
    if (!client) {
      throw new SessionNotFoundError(sessionId);
    }
    return client;
  }

  public async logoutSession(sessionId: string): Promise<void> {
    const client = this.activeClients.get(sessionId);
    if (client) {
      await client.logout();
      this.activeClients.delete(sessionId);
    } else {
      // If client is not in memory but session exists in DB, update status and clear folder
      const dbSession = await sessionRepository.findBySessionId(sessionId);
      if (!dbSession) {
        throw new SessionNotFoundError(sessionId);
      }
      
      // Update database status
      await sessionRepository.updateStatus(sessionId, 'LOGGED_OUT', {
        lastDisconnectedAt: new Date(),
        lastError: 'Session logged out from API',
      });
      
      // Cleanup files if any
      const tempClient = new BaileysClient(sessionId, async () => {});
      await tempClient.logout(); // Cleans up directory
    }
  }

  public async shutdownAll(): Promise<void> {
    logger.info('Closing all active WhatsApp connections...');
    for (const [sessionId, client] of this.activeClients.entries()) {
      try {
        await client.close();
        logger.info({ sessionId }, 'Closed connection');
      } catch (err) {
        logger.error({ err, sessionId }, 'Error closing connection');
      }
    }
    this.activeClients.clear();
  }
}

export const sessionManager = new SessionManager();
export default sessionManager;
