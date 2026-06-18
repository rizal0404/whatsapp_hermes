import { FastifyInstance } from 'fastify';
import {
  createRecipient,
  listRecipients,
  getRecipient,
  updateRecipient,
  deleteRecipient,
} from './recipient.controller';

export async function recipientRoutes(fastify: FastifyInstance) {
  fastify.post('/recipients', createRecipient);
  fastify.get('/recipients', listRecipients);
  fastify.get('/recipients/:id', getRecipient);
  fastify.put('/recipients/:id', updateRecipient);
  fastify.delete('/recipients/:id', deleteRecipient);
}
