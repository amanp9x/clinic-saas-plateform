import { createServer } from 'node:http';
import { createApp } from './app.js';
import { createSocketServer } from './config/socket.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

async function main(): Promise<void> {
  await connectDatabase();

  // Best-effort: nothing on the current request path requires Redis yet (OTP
  // rate-limiting is Postgres-backed). Don't block startup on it, but do log loudly.
  try {
    await connectRedis();
  } catch (err) {
    logger.warn({ err }, 'Redis unavailable at startup — continuing without it');
  }

  const app = createApp();
  const httpServer = createServer(app);
  createSocketServer(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received, shutting down gracefully`);
    httpServer.close();
    await Promise.all([disconnectDatabase(), disconnectRedis()]);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal error during startup');
  process.exit(1);
});
