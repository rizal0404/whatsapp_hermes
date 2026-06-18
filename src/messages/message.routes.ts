import { FastifyInstance } from 'fastify';
import { sendText, sendDocument, getMessageStatus } from './message.controller';

export async function messageRoutes(fastify: FastifyInstance) {
  fastify.post('/messages/send-text', sendText);
  fastify.post('/messages/send-document', sendDocument);
  fastify.get('/messages/:messageId/status', getMessageStatus);
}
