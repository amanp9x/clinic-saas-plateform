import { Router } from 'express';
import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const healthRouter = Router();

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [dbOk, redisOk] = await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      redis
        .ping()
        .then(() => true)
        .catch(() => false),
    ]);

    sendSuccess(res, {
      status: dbOk && redisOk ? 'ok' : 'degraded',
      uptime: process.uptime(),
      dependencies: { database: dbOk ? 'up' : 'down', redis: redisOk ? 'up' : 'down' },
    });
  }),
);
