import { FastifyReply } from 'fastify';
import { AppError } from './errors';
import { logger } from './logger';
import { env } from '../config/env';

export const sendSuccess = (reply: FastifyReply, data: any = {}, statusCode: number = 200) => {
  return reply.code(statusCode).send({
    success: true,
    data,
  });
};

export const sendError = (reply: FastifyReply, error: any) => {
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  // Handle generic errors
  logger.error({ err: error }, 'Unhandled application error');
  
  const message = env.NODE_ENV === 'production'
    ? 'Internal Server Error'
    : (error instanceof Error ? error.message : 'Internal Server Error');

  return reply.code(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
      details: {},
    },
  });
};
