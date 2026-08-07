import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * Shared Redis client. Used for: refresh-token/session bookkeeping, OTP rate
 * limiting, and as the Socket.IO adapter backing store once the API scales
 * beyond a single instance.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err: Error) => logger.error({ err }, 'Redis client error'));
redis.on('connect', () => logger.info('Redis connected'));

export async function connectRedis(): Promise<void> {
  await redis.connect();
}

export async function disconnectRedis(): Promise<void> {
  redis.disconnect();
}
