import { FastifyReply, FastifyRequest } from 'fastify';
import { incomingService } from './incoming.service';
import { sendSuccess } from '../common/response';
import { ValidationError } from '../common/errors';
import { z } from 'zod';
import { incomingPoller } from './incoming.poller';

const listMessagesQuerySchema = z.object({
  triggerType: z.enum(['mention', 'reply', 'mention_reply']).optional(),
  isGroup: z
    .preprocess((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return val;
    }, z.boolean())
    .optional(),
  isRead: z
    .preprocess((val) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return val;
    }, z.boolean())
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const listMessages = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId } = request.params as { sessionId: string };

  const result = listMessagesQuerySchema.safeParse(request.query);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error.format());
  }

  const data = await incomingService.listMessages(sessionId, result.data);
  return sendSuccess(reply, data);
};

export const getMessage = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId, messageId } = request.params as { sessionId: string; messageId: string };
  const message = await incomingService.getMessage(sessionId, messageId);
  return sendSuccess(reply, message);
};

export const markAsRead = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId, messageId } = request.params as { sessionId: string; messageId: string };
  const message = await incomingService.markAsRead(sessionId, messageId);
  return sendSuccess(reply, message);
};

export const markAllAsRead = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId } = request.params as { sessionId: string };
  const count = await incomingService.markAllAsRead(sessionId);
  return sendSuccess(reply, { sessionId, updatedCount: count });
};

export const getUnreadCount = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId } = request.params as { sessionId: string };
  const unreadCount = await incomingService.getUnreadCount(sessionId);
  return sendSuccess(reply, { sessionId, unreadCount });
};

export const pollUnprocessed = async (request: FastifyRequest, reply: FastifyReply) => {
  const queuedCount = await incomingPoller.poll();
  return sendSuccess(reply, { queuedCount, message: `Successfully polled and queued ${queuedCount} webhook(s)` });
};
