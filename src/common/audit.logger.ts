import { prisma } from '../database/prisma';
import { logger } from './logger';

export interface AuditLogPayload {
  actor?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: any;
}

export class AuditLogger {
  async log(payload: AuditLogPayload): Promise<void> {
    try {
      const defaultActor = payload.actor || 'API';
      await prisma.auditLog.create({
        data: {
          actor: defaultActor,
          action: payload.action,
          entityType: payload.entityType || null,
          entityId: payload.entityId || null,
          metadata: payload.metadata || {},
        },
      });
      logger.info(
        {
          actor: defaultActor,
          action: payload.action,
          entityType: payload.entityType,
          entityId: payload.entityId,
        },
        `Audit Log: ${payload.action} on ${payload.entityType || 'unknown'} (${payload.entityId || 'none'})`
      );
    } catch (err) {
      logger.error({ err, payload }, 'Failed to write audit log to database');
    }
  }
}

export const auditLogger = new AuditLogger();
