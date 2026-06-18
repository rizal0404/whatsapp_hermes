import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  ConnectionState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import { env } from '../config/env';
import { logger } from '../common/logger';
import { SessionStatus } from '../sessions/session.types';

export class BaileysClient {
  public socket: WASocket | null = null;
  private reconnectCount = 0;
  private maxReconnects = 5;
  private qrCode: string | null = null;
  private isShuttingDown = false;

  constructor(
    public readonly sessionId: string,
    private onStatusChange: (status: SessionStatus, extra?: any) => Promise<void>
  ) {}

  public getQrCode(): string | null {
    return this.qrCode;
  }

  public async init(): Promise<void> {
    try {
      this.isShuttingDown = false;
      const authDir = path.join(env.WA_AUTH_DIR, this.sessionId);
      
      // Ensure directory exists
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(authDir);

      // Create pino logger for Baileys with a quiet level to avoid excessive console logs
      const baileysLogger = logger.child({ module: `baileys-${this.sessionId}` });
      baileysLogger.level = 'warn'; // Baileys is very chatty

      const { version } = await fetchLatestBaileysVersion();

      this.socket = makeWASocket({
        auth: state,
        logger: baileysLogger as any,
        printQRInTerminal: false,
        browser: Browsers.appropriate('WA-Gateway'),
        version,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
      });

      // Register Creds save handler
      this.socket.ev.on('creds.update', saveCreds);

      // Register Connection update handler
      this.socket.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            // Generate QR base64 image
            this.qrCode = await QRCode.toDataURL(qr);
            await this.onStatusChange('REQUIRES_QR', { qr: this.qrCode });
            logger.info({ sessionId: this.sessionId }, 'New WhatsApp QR code generated');
          } catch (err) {
            logger.error({ err, sessionId: this.sessionId }, 'Failed to generate QR base64');
          }
        }

        if (connection === 'connecting') {
          await this.onStatusChange(this.reconnectCount > 0 ? 'RECONNECTING' : 'INITIALIZING');
        }

        if (connection === 'open') {
          this.reconnectCount = 0;
          this.qrCode = null;
          const userJid = this.socket?.user?.id;
          const phoneNumber = userJid ? userJid.split(':')[0] : undefined;
          
          await this.onStatusChange('CONNECTED', {
            phoneNumber,
            lastConnectedAt: new Date(),
          });
          logger.info({ sessionId: this.sessionId, phoneNumber }, 'WhatsApp session connected successfully');
        }

        if (connection === 'close') {
          this.qrCode = null;
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = 
            statusCode !== DisconnectReason.loggedOut && 
            !this.isShuttingDown && 
            this.reconnectCount < this.maxReconnects;

          logger.warn(
            { 
              sessionId: this.sessionId, 
              statusCode, 
              error: lastDisconnect?.error?.message, 
              shouldReconnect,
              reconnectCount: this.reconnectCount 
            }, 
            'WhatsApp connection closed'
          );

          if (statusCode === DisconnectReason.loggedOut) {
            await this.onStatusChange('LOGGED_OUT', {
              lastDisconnectedAt: new Date(),
              lastError: 'Logged out from mobile device',
            });
            await this.cleanupAuthFolder();
          } else if (shouldReconnect) {
            this.reconnectCount++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectCount), 30000); // Exponential backoff up to 30s
            await this.onStatusChange('RECONNECTING', {
              lastDisconnectedAt: new Date(),
              lastError: lastDisconnect?.error?.message || 'Connection lost, reconnecting...',
            });
            logger.info({ sessionId: this.sessionId, delay }, `Scheduling reconnect attempt ${this.reconnectCount}/${this.maxReconnects}`);
            setTimeout(() => this.init(), delay);
          } else {
            // Max reconnects reached or shutting down
            const finalStatus = statusCode === DisconnectReason.loggedOut ? 'LOGGED_OUT' : 'DISCONNECTED';
            await this.onStatusChange(finalStatus, {
              lastDisconnectedAt: new Date(),
              lastError: lastDisconnect?.error?.message || 'Max reconnection attempts reached',
            });
          }
        }
      });
    } catch (err: any) {
      logger.error({ err, sessionId: this.sessionId }, 'Failed to initialize Baileys connection');
      await this.onStatusChange('ERROR', { lastError: err.message });
    }
  }

  public async logout(): Promise<void> {
    this.isShuttingDown = true;
    if (this.socket) {
      try {
        await this.socket.logout();
      } catch (err) {
        logger.warn({ err, sessionId: this.sessionId }, 'Error calling logout on Baileys socket');
      }
    }
    await this.cleanupAuthFolder();
    await this.onStatusChange('LOGGED_OUT', { lastDisconnectedAt: new Date() });
  }

  public async close(): Promise<void> {
    this.isShuttingDown = true;
    if (this.socket) {
      this.socket.end(undefined);
    }
  }

  private async cleanupAuthFolder(): Promise<void> {
    const authDir = path.join(env.WA_AUTH_DIR, this.sessionId);
    if (fs.existsSync(authDir)) {
      try {
        // Simple recursive delete
        fs.rmSync(authDir, { recursive: true, force: true });
        logger.info({ sessionId: this.sessionId }, 'Cleaned up auth directory');
      } catch (err) {
        logger.error({ err, sessionId: this.sessionId }, 'Failed to cleanup auth directory');
      }
    }
  }
}
