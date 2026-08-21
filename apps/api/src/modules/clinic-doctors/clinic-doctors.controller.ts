import type { Request, Response } from 'express';
import { clinicDoctorsService } from './clinic-doctors.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const clinicDoctorsController = {
  search: asyncHandler(async (req: Request, res: Response) => {
    const doctors = await clinicDoctorsService.searchExistingDoctors(req.user!.id, req.user!.role, req.query.clinicId as string, req.query.q as string);
    sendSuccess(res, { doctors });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as { clinicId: string; q?: string; page: number; limit: number };
    const doctors = await clinicDoctorsService.list(req.user!.id, req.user!.role, query.clinicId, query.q, query.page, query.limit);
    sendSuccess(res, { doctors });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const doctor = await clinicDoctorsService.getById(req.user!.id, req.user!.role, req.query.clinicId as string, req.params.id as string);
    sendSuccess(res, { doctor });
  }),

  associate: asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, ...input } = req.body;
    const doctor = await clinicDoctorsService.associate(req.user!.id, req.user!.role, clinicId, input);
    sendSuccess(res, { doctor }, { status: 201, message: 'Doctor associated with clinic' });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const doctor = await clinicDoctorsService.update(req.user!.id, req.user!.role, req.query.clinicId as string, req.params.id as string, req.body);
    sendSuccess(res, { doctor }, { message: 'Doctor association updated' });
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const { doctor, cancelledAppointmentCount } = await clinicDoctorsService.updateStatus(
      req.user!.id,
      req.user!.role,
      req.query.clinicId as string,
      req.params.id as string,
      req.body,
    );
    sendSuccess(res, { doctor, cancelledAppointmentCount }, { message: 'Doctor status updated' });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const { cancelledAppointmentCount } = await clinicDoctorsService.remove(req.user!.id, req.user!.role, req.query.clinicId as string, req.params.id as string);
    sendSuccess(res, { cancelledAppointmentCount }, { message: 'Doctor association removed' });
  }),
};
