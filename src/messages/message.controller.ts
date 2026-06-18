import { FastifyReply, FastifyRequest } from 'fastify';
import { messageService } from './message.service';
import { sendTextMessageSchema, sendDocumentMessageSchema } from './message.schema';
import { sendSuccess } from '../common/response';
import { ValidationError } from '../common/errors';

export const sendText = async (request: FastifyRequest, reply: FastifyReply) => {
  const result = sendTextMessageSchema.safeParse(request.body);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error.format());
  }

  const log = await messageService.sendText(result.data);

  return sendSuccess(reply, {
    messageId: log.messageId,
    status: log.status,
  });
};

export const sendDocument = async (request: FastifyRequest, reply: FastifyReply) => {
  const result = sendDocumentMessageSchema.safeParse(request.body);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error.format());
  }

  const log = await messageService.sendDocument(result.data);

  return sendSuccess(reply, {
    messageId: log.messageId,
    status: log.status,
  });
};

export const getMessageStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  const { messageId } = request.params as { messageId: string };
  const log = await messageService.getMessageStatus(messageId);

  return sendSuccess(reply, {
    messageId: log.messageId,
    status: log.status,
    sessionId: log.sessionId,
    to: log.recipient,
    attempt: log.attempt,
    lastError: log.lastError,
    createdAt: log.queuedAt || log.createdAt,
    sentAt: log.sentAt,
  });
};
