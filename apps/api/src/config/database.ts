import { PrismaClient } from '@prisma/client';
import { isProduction } from './env.js';
import { logger } from './logger.js';

/**
 * Single shared Prisma client instance. Reused across the process (and across
 * hot reloads in dev) to avoid exhausting the Postgres connection pool.
 */
declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: isProduction ? ['error', 'warn'] : ['error', 'warn', 'query'],
  });

if (!isProduction) {
  global.__prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  logger.info('Database connected');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
