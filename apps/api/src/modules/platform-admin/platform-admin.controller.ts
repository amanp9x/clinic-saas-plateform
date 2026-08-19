import type { Request, Response } from 'express';
import { platformAdminService } from './platform-admin.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const platformAdminController = {
  getOverview: asyncHandler(async (_req: Request, res: Response) => {
    const overview = await platformAdminService.getOverview();
    sendSuccess(res, { overview });
  }),

  listClinics: asyncHandler(async (req: Request, res: Response) => {
    const result = await platformAdminService.listClinics(req.query as never);
    sendSuccess(res, result);
  }),

  getClinicDetail: asyncHandler(async (req: Request, res: Response) => {
    const clinic = await platformAdminService.getClinicDetail(req.params.id!);
    sendSuccess(res, { clinic });
  }),

  updateVerification: asyncHandler(async (req: Request, res: Response) => {
    const clinic = await platformAdminService.updateVerification(req.user!.id, req.params.id!, req.body);
    sendSuccess(res, { clinic }, { message: 'Verification status updated' });
  }),

  updateDocumentStatus: asyncHandler(async (req: Request, res: Response) => {
    const clinic = await platformAdminService.updateDocumentStatus(req.user!.id, req.params.id!, req.params.documentId!, req.body);
    sendSuccess(res, { clinic }, { message: 'Document status updated' });
  }),

  listComplianceDocuments: asyncHandler(async (req: Request, res: Response) => {
    const result = await platformAdminService.listComplianceDocuments(req.query as never);
    sendSuccess(res, result);
  }),
};
