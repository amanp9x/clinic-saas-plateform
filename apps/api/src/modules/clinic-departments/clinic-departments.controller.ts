import type { Request, Response } from 'express';
import { clinicDepartmentsService } from './clinic-departments.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const clinicDepartmentsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const departments = await clinicDepartmentsService.list(req.user!.id, req.user!.role, req.query.clinicId as string, req.query.q as string | undefined);
    sendSuccess(res, { departments });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, ...input } = req.body;
    const department = await clinicDepartmentsService.create(req.user!.id, req.user!.role, clinicId, input);
    sendSuccess(res, { department }, { status: 201, message: 'Department created' });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const department = await clinicDepartmentsService.update(req.user!.id, req.user!.role, req.query.clinicId as string, req.params.id as string, req.body);
    sendSuccess(res, { department }, { message: 'Department updated' });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await clinicDepartmentsService.remove(req.user!.id, req.user!.role, req.query.clinicId as string, req.params.id as string);
    sendSuccess(res, null, { message: 'Department deleted' });
  }),
};
