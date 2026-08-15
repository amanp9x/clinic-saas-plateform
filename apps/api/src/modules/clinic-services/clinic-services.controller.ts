import type { Request, Response } from 'express';
import { clinicServicesService } from './clinic-services.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const clinicServicesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const services = await clinicServicesService.list(req.user!.id, req.user!.role, req.query.clinicId as string, req.query.q as string | undefined);
    sendSuccess(res, { services });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, ...input } = req.body;
    const service = await clinicServicesService.create(req.user!.id, req.user!.role, clinicId, input);
    sendSuccess(res, { service }, { status: 201, message: 'Service created' });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const service = await clinicServicesService.update(req.user!.id, req.user!.role, req.query.clinicId as string, req.params.id as string, req.body);
    sendSuccess(res, { service }, { message: 'Service updated' });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await clinicServicesService.remove(req.user!.id, req.user!.role, req.query.clinicId as string, req.params.id as string);
    sendSuccess(res, null, { message: 'Service deleted' });
  }),
};
