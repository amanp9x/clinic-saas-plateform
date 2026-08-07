import type { Request, Response } from 'express';
import { ErrorCode, type ApiErrorResponse } from '@clinic/shared';

export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiErrorResponse = {
    success: false,
    error: { code: ErrorCode.NOT_FOUND, message: `Route ${req.method} ${req.path} not found` },
  };
  res.status(404).json(body);
}
