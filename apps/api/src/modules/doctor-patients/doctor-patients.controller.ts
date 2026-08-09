import type { Request, Response } from 'express';
import { doctorPatientsService } from './doctor-patients.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const doctorPatientsController = {
  getProfile: asyncHandler(async (req: Request, res: Response) => {
    const patient = await doctorPatientsService.getProfile(req.user!.id, req.params.patientId!);
    sendSuccess(res, { patient });
  }),

  getMedicalHistory: asyncHandler(async (req: Request, res: Response) => {
    const history = await doctorPatientsService.getMedicalHistory(req.user!.id, req.params.patientId!);
    sendSuccess(res, { history });
  }),
};
