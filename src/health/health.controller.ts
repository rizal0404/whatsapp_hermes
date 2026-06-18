import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../database/prisma';
import { checkRedisHealth } from '../database/redis';
import { sendSuccess } from '../common/response';

const startTime = Date.now();

export const getHealth = async (request: FastifyRequest, reply: FastifyReply) => {
  let dbStatus = 'OK';
  let redisStatus = 'OK';
  let isHealthy = true;

  // Check Database
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = 'DOWN';
    isHealthy = false;
  }

  // Check Redis
  const redisOk = await checkRedisHealth();
  if (!redisOk) {
    redisStatus = 'DOWN';
    isHealthy = false;
  }

  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

  const statusCode = isHealthy ? 200 : 503;

  return reply.code(statusCode).send({
    success: isHealthy,
    data: {
      service: 'wa-gateway',
      status: isHealthy ? 'OK' : 'DEGRADED',
      database: dbStatus,
      redis: redisStatus,
      uptimeSeconds,
    },
  });
};
