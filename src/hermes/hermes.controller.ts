import { FastifyReply, FastifyRequest } from 'fastify';
import { hermesService } from './hermes.service';
import { hermesSendDailyReportSchema } from './hermes.schema';
import { sendSuccess } from '../common/response';
import { ValidationError } from '../common/errors';

export const sendDailyReport = async (request: FastifyRequest, reply: FastifyReply) => {
  const result = hermesSendDailyReportSchema.safeParse(request.body);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error.format());
  }

  const batch = await hermesService.sendDailyReport(result.data);

  return sendSuccess(reply, {
    batchId: batch.id,
    status: batch.status,
    totalRecipients: batch.totalMessages,
  });
};

export const getBatchStatus = async (request: FastifyRequest, reply: FastifyReply) => {
  const { batchId } = request.params as { batchId: string };
  const batch = await hermesService.getBatchStatus(batchId);

  return sendSuccess(reply, {
    batchId: batch.id,
    batchKey: batch.batchKey,
    status: batch.status,
    totalMessages: batch.totalMessages,
    successCount: batch.successCount,
    failedCount: batch.failedCount,
    createdAt: batch.createdAt,
    completedAt: batch.completedAt,
    messages: batch.messages,
  });
};
