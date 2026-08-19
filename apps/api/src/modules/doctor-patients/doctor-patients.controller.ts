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

  createLabReport: asyncHandler(async (req: Request, res: Response) => {
    const report = await doctorPatientsService.createLabReport(req.user!.id, req.params.patientId!, req.body);
    sendSuccess(res, { report }, { status: 201, message: 'Lab report ordered' });
  }),

  updateLabReport: asyncHandler(async (req: Request, res: Response) => {
    const report = await doctorPatientsService.updateLabReport(req.user!.id, req.params.patientId!, req.params.id!, req.body, req.file);
    sendSuccess(res, { report }, { message: 'Lab report updated' });
  }),

  createVaccination: asyncHandler(async (req: Request, res: Response) => {
    const vaccination = await doctorPatientsService.createVaccination(req.user!.id, req.params.patientId!, req.body);
    sendSuccess(res, { vaccination }, { status: 201, message: 'Vaccination recorded' });
  }),
};
