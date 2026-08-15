import type { Request, Response } from 'express';
import { clinicResourcesService } from './clinic-resources.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const clinicResourcesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const resources = await clinicResourcesService.list(req.user!.id, req.user!.role, req.query.clinicId as string);
    sendSuccess(res, { resources });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, ...input } = req.body;
    const resource = await clinicResourcesService.create(req.user!.id, req.user!.role, clinicId, input);
    sendSuccess(res, { resource }, { status: 201, message: 'Resource created' });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const resource = await clinicResourcesService.update(req.user!.id, req.user!.role, req.query.clinicId as string, req.params.id as string, req.body);
    sendSuccess(res, { resource }, { message: 'Resource updated' });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await clinicResourcesService.remove(req.user!.id, req.user!.role, req.query.clinicId as string, req.params.id as string);
    sendSuccess(res, null, { message: 'Resource deleted' });
  }),
};
