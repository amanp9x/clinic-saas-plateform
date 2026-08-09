import type { Request, Response } from 'express';
import { medicalRecordsService } from './medical-records.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const medicalRecordsController = {
  history: asyncHandler(async (req: Request, res: Response) => {
    const records = await medicalRecordsService.history(req.user!.id);
    sendSuccess(res, { records });
  }),

  prescriptions: asyncHandler(async (req: Request, res: Response) => {
    const prescriptions = await medicalRecordsService.prescriptions(req.user!.id);
    sendSuccess(res, { prescriptions });
  }),

  labReports: asyncHandler(async (req: Request, res: Response) => {
    const reports = await medicalRecordsService.labReports(req.user!.id);
    sendSuccess(res, { reports });
  }),

  vaccinations: asyncHandler(async (req: Request, res: Response) => {
    const vaccinations = await medicalRecordsService.vaccinations(req.user!.id);
    sendSuccess(res, { vaccinations });
  }),

  vitals: asyncHandler(async (req: Request, res: Response) => {
    const vitals = await medicalRecordsService.vitals(req.user!.id);
    sendSuccess(res, { vitals });
  }),

  downloads: asyncHandler(async (req: Request, res: Response) => {
    const downloads = await medicalRecordsService.downloads(req.user!.id);
    sendSuccess(res, { downloads });
  }),
};
