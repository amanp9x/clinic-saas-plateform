import type { Request, Response } from 'express';
import type { ClinicReportsQuery } from '@clinic/shared';
import { clinicReportsService } from './clinic-reports.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const clinicReportsController = {
  get: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ClinicReportsQuery;
    const report = await clinicReportsService.getReports(req.user!.id, req.user!.role, query.clinicId, query.from, query.to);
    sendSuccess(res, { report });
  }),
};
