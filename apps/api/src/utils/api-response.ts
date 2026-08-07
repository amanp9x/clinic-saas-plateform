import type { Response } from 'express';
import type { ApiSuccessResponse, PaginationMeta } from '@clinic/shared';

export function sendSuccess<T>(
  res: Response,
  data: T,
  {
    status = 200,
    message,
    meta,
  }: { status?: number; message?: string; meta?: Record<string, unknown> } = {},
): Response {
  const body: ApiSuccessResponse<T> = { success: true, data, message, meta };
  return res.status(status).json(body);
}

export function sendPaginated<T>(
  res: Response,
  items: T[],
  pagination: PaginationMeta,
  status = 200,
): Response {
  return res.status(status).json({ success: true, data: items, meta: pagination });
}
