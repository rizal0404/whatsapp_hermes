import { prisma } from '../database/prisma';
import { SessionStatus } from './session.types';
import { WASession } from '@prisma/client';

export class SessionRepository {
  async create(sessionId: string, label?: string): Promise<WASession> {
    return prisma.wASession.create({
      data: {
        sessionId,
        label,
        status: 'INITIALIZING',
      },
    });
  }

  async findBySessionId(sessionId: string): Promise<WASession | null> {
    return prisma.wASession.findUnique({
      where: { sessionId },
    });
  }

  async updateStatus(
    sessionId: string,
    status: SessionStatus,
    extra: Partial<Omit<WASession, 'id' | 'sessionId' | 'status' | 'createdAt' | 'updatedAt'>> = {}
  ): Promise<WASession> {
    return prisma.wASession.update({
      where: { sessionId },
      data: {
        status,
        ...extra,
      },
    });
  }

  async listAll(): Promise<WASession[]> {
    return prisma.wASession.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(sessionId: string): Promise<void> {
    await prisma.wASession.delete({
      where: { sessionId },
    });
  }
}

export const sessionRepository = new SessionRepository();
