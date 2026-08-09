import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestLogger } from './middleware/request-logger.js';
import { apiRateLimiter } from './middleware/rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { apiRouter } from './routes/index.js';
import { UPLOADS_DIR, UPLOADS_URL_PREFIX } from './services/storage.service.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));
  app.use(requestLogger);
  app.use(apiRateLimiter);

  app.get('/health', (_req, res) =>
    res.status(200).json({ success: true, data: { status: 'ok' } }),
  );

  // Uploaded files (profile photos, etc.) — cross-origin readable since the web app runs on a
  // different origin. Helmet's default same-origin CORP header is overridden just for this path.
  app.use(
    UPLOADS_URL_PREFIX,
    express.static(UPLOADS_DIR, {
      setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
    }),
  );

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
