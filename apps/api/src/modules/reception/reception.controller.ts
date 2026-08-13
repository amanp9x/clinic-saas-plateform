import type { Request, Response } from 'express';
import { receptionService } from './reception.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const receptionController = {
  listMyClinics: asyncHandler(async (req: Request, res: Response) => {
    const clinics = await receptionService.listMyClinics(req.user!.id, req.user!.role);
    sendSuccess(res, { clinics });
  }),

  dashboard: asyncHandler(async (req: Request, res: Response) => {
    const summary = await receptionService.dashboard(req.user!.id, req.user!.role, req.query.clinicId as string);
    sendSuccess(res, { summary });
  }),

  listDoctorStatuses: asyncHandler(async (req: Request, res: Response) => {
    const doctors = await receptionService.listDoctorStatuses(req.user!.id, req.user!.role, req.query.clinicId as string);
    sendSuccess(res, { doctors });
  }),

  updateDoctorStatus: asyncHandler(async (req: Request, res: Response) => {
    const doctor = await receptionService.updateDoctorStatus(
      req.user!.id,
      req.user!.role,
      req.body.clinicId,
      req.params.doctorId as string,
      req.body.status,
    );
    sendSuccess(res, { doctor }, { message: 'Doctor status updated' });
  }),

  reports: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as { clinicId: string; from: string; to: string };
    const report = await receptionService.reports(req.user!.id, req.user!.role, query.clinicId, query.from, query.to);
    sendSuccess(res, { report });
  }),
};
