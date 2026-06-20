import makeWASocket, {
  Browsers,
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  ConnectionState,
  fetchLatestBaileysVersion,
  WAMessage,
  proto,
} from '@whiskeysockets/baileys';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import { env } from '../config/env';
import { logger } from '../common/logger';
import { SessionStatus } from '../sessions/session.types';
import { IncomingMessageData, TriggerType, IncomingMessageType } from '../incoming/incoming.types';
import { isSameUser, normalizeUserJid, extractPhoneFromJid } from './jid.util';

export type IncomingMessageCallback = (data: IncomingMessageData) => Promise<void>;

export class BaileysClient {
  public socket: WASocket | null = null;
  private reconnectCount = 0;
  private maxReconnects = 5;
  private qrCode: string | null = null;
  private isShuttingDown = false;
  private incomingMessageHandler: IncomingMessageCallback | null = null;

  constructor(
    public readonly sessionId: string,
    private onStatusChange: (status: SessionStatus, extra?: any) => Promise<void>
  ) {}

  public getQrCode(): string | null {
    return this.qrCode;
  }

  /**
   * Register a handler for incoming messages (mentions & replies).
   * Must be called before init() or between reconnects.
   */
  public setIncomingMessageHandler(handler: IncomingMessageCallback): void {
    this.incomingMessageHandler = handler;
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
          const phoneNumber = userJid ? extractPhoneFromJid(userJid) : undefined;
          
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

      // Register Incoming Messages handler (mentions & replies)
      if (this.incomingMessageHandler) {
        this.socket.ev.on('messages.upsert', async ({ messages, type }) => {
          // Only process real-time notifications, skip history sync
          if (type !== 'notify') return;

          for (const msg of messages) {
            try {
              await this.processIncomingMessage(msg);
            } catch (err) {
              logger.error({ err, sessionId: this.sessionId, waMessageId: msg.key?.id }, 'Error processing incoming message');
            }
          }
        });
      }
    } catch (err: any) {
      logger.error({ err, sessionId: this.sessionId }, 'Failed to initialize Baileys connection');
      await this.onStatusChange('ERROR', { lastError: err.message });
    }
  }

  /**
   * Process a single incoming message: detect mentions and replies to the session user.
   */
  private async processIncomingMessage(msg: WAMessage): Promise<void> {
    if (!this.incomingMessageHandler || !this.socket) return;

    // 1. Skip messages sent by the session user
    if (msg.key.fromMe) return;

    // 2. Skip status broadcasts and protocol messages
    const remoteJid = msg.key.remoteJid;
    if (!remoteJid || remoteJid === 'status@broadcast') return;

    // 3. Get the session user's JID for comparison
    const sessionUserJid = this.socket.user?.id;
    if (!sessionUserJid) return;

    // Support WhatsApp LID (List Identifier) format for mentions/replies
    const sessionUserLid = (this.socket.user as any)?.lid;

    // 4. Extract the message content and contextInfo
    const messageContent = msg.message;
    if (!messageContent) return;

    // Skip ephemeral/protocol wrappers — unwrap if needed
    const innerMessage = messageContent.ephemeralMessage?.message || messageContent;

    // Get contextInfo from whichever message type is present
    const contextInfo = this.extractContextInfo(innerMessage);
    const textContent = this.extractTextContent(innerMessage);
    const messageType = this.detectMessageType(innerMessage);

    // 5. Check for mention
    let isMentioned = false;
    if (contextInfo?.mentionedJid && contextInfo.mentionedJid.length > 0) {
      isMentioned = contextInfo.mentionedJid.some((jid) => {
        return isSameUser(jid, sessionUserJid) || isSameUser(jid, sessionUserLid);
      });
    }

    // 6. Check for reply/quote
    let isReplied = false;
    let quotedMessageId: string | null = null;
    let quotedContent: string | null = null;
    if (contextInfo?.quotedMessage) {
      const quotedParticipant = contextInfo.participant || '';
      
      if (isSameUser(quotedParticipant, sessionUserJid) || isSameUser(quotedParticipant, sessionUserLid)) {
        isReplied = true;
        quotedMessageId = contextInfo.stanzaId || null;
        quotedContent = this.extractTextContent(contextInfo.quotedMessage) || null;
      }
    }

    // 7. Determine trigger type
    if (!isMentioned && !isReplied) return; // Not relevant, skip

    let triggerType: TriggerType;
    if (isMentioned && isReplied) {
      triggerType = 'mention_reply';
    } else if (isMentioned) {
      triggerType = 'mention';
    } else {
      triggerType = 'reply';
    }

    // 8. Determine sender
    const isGroup = remoteJid.endsWith('@g.us');
    const senderJid = isGroup
      ? (msg.key.participant || '')
      : remoteJid;

    // 9. Build the incoming message data
    const timestamp = msg.messageTimestamp
      ? new Date(typeof msg.messageTimestamp === 'number'
          ? msg.messageTimestamp * 1000
          : Number(msg.messageTimestamp) * 1000)
      : new Date();

    const data: IncomingMessageData = {
      sessionId: this.sessionId,
      remoteJid,
      senderJid,
      senderName: msg.pushName || null,
      waMessageId: msg.key.id || '',
      triggerType,
      messageType,
      content: textContent || null,
      quotedMessageId,
      quotedContent,
      isGroup,
      groupName: null, // Will be resolved by the listener if needed
      messageTimestamp: timestamp,
      rawPayload: JSON.parse(JSON.stringify(msg)), // Deep clone for safe serialization
    };

    // 10. Fire the callback (fire-and-forget from Baileys perspective)
    logger.info(
      {
        sessionId: this.sessionId,
        triggerType,
        senderJid,
        remoteJid,
        isGroup,
        waMessageId: msg.key.id,
      },
      `Incoming ${triggerType} message detected`
    );

    await this.incomingMessageHandler(data);
  }

  /**
   * Extract contextInfo from any message type.
   */
  private extractContextInfo(msg: any): proto.IContextInfo | null {
    if (!msg) return null;
    // Check all known message types that can have contextInfo
    const types = [
      'extendedTextMessage',
      'imageMessage',
      'videoMessage',
      'documentMessage',
      'audioMessage',
      'stickerMessage',
      'contactMessage',
      'locationMessage',
      'viewOnceMessage',
      'viewOnceMessageV2',
    ];
    for (const type of types) {
      if (msg[type]?.contextInfo) {
        return msg[type].contextInfo;
      }
    }
    // Also check viewOnceMessage wrapper
    if (msg.viewOnceMessage?.message) {
      return this.extractContextInfo(msg.viewOnceMessage.message);
    }
    if (msg.viewOnceMessageV2?.message) {
      return this.extractContextInfo(msg.viewOnceMessageV2.message);
    }
    return null;
  }

  /**
   * Extract text content from any message type.
   */
  private extractTextContent(msg: any): string | null {
    if (!msg) return null;
    if (msg.conversation) return msg.conversation;
    if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
    if (msg.imageMessage?.caption) return msg.imageMessage.caption;
    if (msg.videoMessage?.caption) return msg.videoMessage.caption;
    if (msg.documentMessage?.caption) return msg.documentMessage.caption;
    if (msg.documentMessage?.title) return msg.documentMessage.title;
    if (msg.viewOnceMessage?.message) return this.extractTextContent(msg.viewOnceMessage.message);
    if (msg.viewOnceMessageV2?.message) return this.extractTextContent(msg.viewOnceMessageV2.message);
    return null;
  }

  /**
   * Detect the message type from the inner message content.
   */
  private detectMessageType(msg: any): IncomingMessageType {
    if (!msg) return 'other';
    if (msg.conversation || msg.extendedTextMessage) return 'text';
    if (msg.imageMessage) return 'image';
    if (msg.videoMessage) return 'video';
    if (msg.documentMessage) return 'document';
    if (msg.audioMessage) return 'audio';
    if (msg.stickerMessage) return 'sticker';
    if (msg.viewOnceMessage?.message) return this.detectMessageType(msg.viewOnceMessage.message);
    if (msg.viewOnceMessageV2?.message) return this.detectMessageType(msg.viewOnceMessageV2.message);
    return 'other';
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
