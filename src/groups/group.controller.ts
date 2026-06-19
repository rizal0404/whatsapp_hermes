import { FastifyReply, FastifyRequest } from 'fastify';
import { groupService } from './group.service';
import { sendSuccess } from '../common/response';
import { ValidationError } from '../common/errors';

export const listGroups = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId } = request.params as { sessionId: string };

  if (!sessionId || sessionId.trim() === '') {
    throw new ValidationError('sessionId is required');
  }

  const groups = await groupService.listGroups(sessionId);

  return sendSuccess(reply, {
    sessionId,
    totalGroups: groups.length,
    groups,
  });
};

export const getGroupDetail = async (request: FastifyRequest, reply: FastifyReply) => {
  const { sessionId, groupJid } = request.params as { sessionId: string; groupJid: string };

  if (!sessionId || sessionId.trim() === '') {
    throw new ValidationError('sessionId is required');
  }

  if (!groupJid || groupJid.trim() === '') {
    throw new ValidationError('groupJid is required');
  }

  const detail = await groupService.getGroupDetail(sessionId, groupJid);

  return sendSuccess(reply, detail);
};
