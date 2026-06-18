import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../database/prisma';
import { messageQueue } from '../messages/message.queue';
import { sendSuccess } from '../common/response';

export const getMetrics = async (request: FastifyRequest, reply: FastifyReply) => {
  // 1. Session Counts
  const sessions = await prisma.wASession.findMany({
    select: { status: true },
  });
  
  const activeSessionCount = sessions.filter((s) => s.status === 'CONNECTED').length;
  const disconnectedSessionCount = sessions.filter((s) => s.status === 'DISCONNECTED' || s.status === 'RECONNECTING').length;
  const totalSessionCount = sessions.length;

  // 2. Message Status Counts
  const messageCountsGroup = await prisma.messageLog.groupBy({
    by: ['status'],
    _count: {
      status: true,
    },
  });

  const messageCounts: Record<string, number> = {
    QUEUED: 0,
    PROCESSING: 0,
    SENT: 0,
    FAILED: 0,
    RETRYING: 0,
    EXPIRED: 0,
  };

  messageCountsGroup.forEach((group) => {
    messageCounts[group.status] = group._count.status;
  });

  // 3. Retry counts (sum of attempts in message_logs)
  const retryAggregation = await prisma.messageLog.aggregate({
    _sum: {
      attempt: true,
    },
  });
  const totalRetryCount = retryAggregation._sum.attempt || 0;

  // 4. BullMQ Queue Status Counts
  const queueCounts = await messageQueue.getJobCounts();

  return sendSuccess(reply, {
    sessions: {
      total: totalSessionCount,
      active: activeSessionCount,
      disconnected: disconnectedSessionCount,
    },
    messages: {
      queued: messageCounts.QUEUED,
      processing: messageCounts.PROCESSING,
      sent: messageCounts.SENT,
      failed: messageCounts.FAILED,
      retrying: messageCounts.RETRYING,
      expired: messageCounts.EXPIRED,
      totalRetryCount,
    },
    queue: {
      waiting: queueCounts.waiting,
      active: queueCounts.active,
      delayed: queueCounts.delayed,
      failed: queueCounts.failed,
      completed: queueCounts.completed,
    },
  });
};
