import { FastifyReply, FastifyRequest } from 'fastify';
import { recipientRepository } from './recipient.repository';
import { sendSuccess } from '../common/response';
import { z } from 'zod';
import { ValidationError, AppError } from '../common/errors';
import { normalizeJid, getRecipientType } from '../whatsapp/jid.util';
import { auditLogger } from '../common/audit.logger';

const createRecipientSchema = z.object({
  name: z.string().min(1, 'name is required'),
  to: z.string().min(1, 'to (phone or group JID) is required'),
  isActive: z.boolean().optional(),
});

const updateRecipientSchema = z.object({
  name: z.string().optional(),
  to: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const createRecipient = async (request: FastifyRequest, reply: FastifyReply) => {
  const result = createRecipientSchema.safeParse(request.body);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error.format());
  }

  const { name, to, isActive } = result.data;

  // Normalize recipient JID
  const normalizedJid = normalizeJid(to);
  const type = getRecipientType(normalizedJid);

  // Check if JID already exists
  const existing = await recipientRepository.findByTo(normalizedJid);
  if (existing) {
    throw new ValidationError(`Recipient with target '${normalizedJid}' already exists`);
  }

  const recipient = await recipientRepository.create({
    name,
    to: normalizedJid,
    type,
    isActive,
  });

  // Audit log
  await auditLogger.log({
    action: 'RECIPIENT_CREATE',
    entityType: 'Recipient',
    entityId: recipient.id,
    metadata: { name, to: normalizedJid, type, isActive },
  });

  return sendSuccess(reply, recipient, 201);
};

export const listRecipients = async (request: FastifyRequest, reply: FastifyReply) => {
  const { active } = request.query as { active?: string };
  const onlyActive = active === 'true';
  const recipients = await recipientRepository.listAll(onlyActive);
  return sendSuccess(reply, recipients);
};

export const getRecipient = async (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as { id: string };
  const recipient = await recipientRepository.findById(id);
  if (!recipient) {
    throw new AppError('VALIDATION_ERROR', `Recipient with ID '${id}' not found`, 404);
  }
  return sendSuccess(reply, recipient);
};

export const updateRecipient = async (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as { id: string };
  const result = updateRecipientSchema.safeParse(request.body);
  if (!result.success) {
    throw new ValidationError('Validation failed', result.error.format());
  }

  // Verify exists
  const existing = await recipientRepository.findById(id);
  if (!existing) {
    throw new AppError('VALIDATION_ERROR', `Recipient with ID '${id}' not found`, 404);
  }

  const data: any = { ...result.data };
  if (data.to) {
    data.to = normalizeJid(data.to);
    data.type = getRecipientType(data.to);
  }

  const recipient = await recipientRepository.update(id, data);

  // Audit log
  await auditLogger.log({
    action: 'RECIPIENT_UPDATE',
    entityType: 'Recipient',
    entityId: recipient.id,
    metadata: data,
  });

  return sendSuccess(reply, recipient);
};

export const deleteRecipient = async (request: FastifyRequest, reply: FastifyReply) => {
  const { id } = request.params as { id: string };
  
  // Verify exists
  const existing = await recipientRepository.findById(id);
  if (!existing) {
    throw new AppError('VALIDATION_ERROR', `Recipient with ID '${id}' not found`, 404);
  }

  await recipientRepository.delete(id);

  // Audit log
  await auditLogger.log({
    action: 'RECIPIENT_DELETE',
    entityType: 'Recipient',
    entityId: id,
    metadata: { name: existing.name, to: existing.to },
  });

  return sendSuccess(reply, { message: 'Recipient deleted successfully' });
};
