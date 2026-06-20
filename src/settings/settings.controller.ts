import { FastifyReply, FastifyRequest } from 'fastify';
import { settingsRepository } from './settings.repository';
import { sendSuccess } from '../common/response';
import { ValidationError } from '../common/errors';
import { z } from 'zod';
import { env } from '../config/env';

const updateSettingsSchema = z.object({
  incomingRetentionDays: z.coerce.number().int().min(1).max(365).optional(),
  webhookUrl: z
    .string()
    .refine((val) => val === '' || z.string().url().safeParse(val).success, {
      message: 'webhookUrl must be a valid URL or an empty string',
    })
    .optional(),
});

export const getSettings = async (request: FastifyRequest, reply: FastifyReply) => {
  const settings = await settingsRepository.getAll();

  const incomingRetentionDays = settings.incomingRetentionDays
    ? parseInt(settings.incomingRetentionDays, 10)
    : env.INCOMING_RETENTION_DAYS;

  const webhookUrl = settings.webhookUrl !== undefined ? settings.webhookUrl : env.WEBHOOK_URL;

  return sendSuccess(reply, {
    incomingRetentionDays,
    webhookUrl: webhookUrl || null,
  });
};

export const updateSettings = async (request: FastifyRequest, reply: FastifyReply) => {
  const result = updateSettingsSchema.safeParse(request.body);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error.format());
  }

  const { incomingRetentionDays, webhookUrl } = result.data;

  if (incomingRetentionDays !== undefined) {
    await settingsRepository.set('incomingRetentionDays', incomingRetentionDays.toString());
  }

  if (webhookUrl !== undefined) {
    await settingsRepository.set('webhookUrl', webhookUrl);
  }

  // Get current merged settings to return
  const settings = await settingsRepository.getAll();
  const currentDays = settings.incomingRetentionDays
    ? parseInt(settings.incomingRetentionDays, 10)
    : env.INCOMING_RETENTION_DAYS;
  const currentUrl = settings.webhookUrl !== undefined ? settings.webhookUrl : env.WEBHOOK_URL;

  return sendSuccess(reply, {
    incomingRetentionDays: currentDays,
    webhookUrl: currentUrl || null,
  });
};
