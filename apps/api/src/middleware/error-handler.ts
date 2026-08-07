import type { NextFunction, Request, Response } from 'express';
import { ErrorCode, type ApiErrorResponse } from '@clinic/shared';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error.js';
import { logger } from '../config/logger.js';
import { isProduction } from '../config/env.js';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    const body: ApiErrorResponse = {
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: err.flatten(),
      },
    };
    res.status(400).json(body);
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err }, err.message);
    }
    const body: ApiErrorResponse = {
      success: false,
      error: { code: err.code, message: err.message, details: err.details },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error');

  const body: ApiErrorResponse = {
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: isProduction ? 'Internal server error' : (err as Error)?.message || 'Unknown error',
    },
  };
  res.status(500).json(body);
}
