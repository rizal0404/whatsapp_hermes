import { FastifyReply, FastifyRequest } from 'fastify';
import { sessionService } from './session.service';
import { sendSuccess } from '../common/response';
import { z } from 'zod';
import { ValidationError } from '../common/errors';

const createSessionSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  label: z.string().optional(),
});

export const createSession = async (request: FastifyRequest, reply: FastifyReply) => {
  const result = createSessionSchema.safeParse(request.body);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error.format());
  }

  const { sessionId, label } = result.data;
  const session = await sessionService.createSession(sessionId, label);

  return sendSuccess(reply, {
    sessionId: session.sessionId,
    status: session.status,
  }, 201);
};

export const getSessionStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId } = request.params as { sessionId: string };
  const session = await sessionService.getSessionStatus(sessionId);

  return sendSuccess(reply, {
    sessionId: session.sessionId,
    status: session.status,
    phoneNumber: session.phoneNumber,
    lastConnectedAt: session.lastConnectedAt,
    lastDisconnectedAt: session.lastDisconnectedAt,
  });
};

export const getSessionQr = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId } = request.params as { sessionId: string };
  const qrData = await sessionService.getSessionQr(sessionId);

  return sendSuccess(reply, qrData);
};

export const logoutSession = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId } = request.params as { sessionId: string };
  const session = await sessionService.logoutSession(sessionId);

  return sendSuccess(reply, {
    sessionId: session.sessionId,
    status: session.status,
  });
};

export const listSessions = async (request: FastifyRequest, reply: FastifyReply) => {
  const sessions = await sessionService.listSessions();
  const data = sessions.map((s) => ({
    sessionId: s.sessionId,
    label: s.label,
    status: s.status,
    phoneNumber: s.phoneNumber,
  }));
  return sendSuccess(reply, data);
};
