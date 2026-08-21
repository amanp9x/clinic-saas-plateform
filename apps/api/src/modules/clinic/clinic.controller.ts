import type { Request, Response } from 'express';
import fs from 'node:fs';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { ValidationError } from '../../utils/app-error.js';
import { clinicService } from './clinic.service.js';

export const clinicController = {
  getProfile: asyncHandler(async (req: Request, res: Response) => {
    const clinic = await clinicService.getProfile(req.user!.id, req.user!.role, req.query.clinicId as string);
    sendSuccess(res, { clinic });
  }),

  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, ...input } = req.body;
    const clinic = await clinicService.updateProfile(req.user!.id, req.user!.role, clinicId, input);
    sendSuccess(res, { clinic }, { message: 'Clinic profile updated' });
  }),

  submitVerification: asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, ...input } = req.body;
    const clinic = await clinicService.submitVerification(req.user!.id, req.user!.role, clinicId, input);
    sendSuccess(res, { clinic }, { message: 'Verification submitted' });
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, ...input } = req.body;
    const { clinic, cancelledAppointmentCount } = await clinicService.updateStatus(req.user!.id, req.user!.role, clinicId, input);
    sendSuccess(res, { clinic, cancelledAppointmentCount }, { message: 'Clinic status updated' });
  }),

  getSettings: asyncHandler(async (req: Request, res: Response) => {
    const settings = await clinicService.getSettings(req.user!.id, req.user!.role, req.query.clinicId as string);
    sendSuccess(res, { settings });
  }),

  updateSettings: asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, ...input } = req.body;
    const settings = await clinicService.updateSettings(req.user!.id, req.user!.role, clinicId, input);
    sendSuccess(res, { settings }, { message: 'Clinic settings updated' });
  }),

  uploadDocument: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw new ValidationError('A file is required');
    const document = await clinicService.uploadDocument(req.user!.id, req.user!.role, req.body.clinicId, req.body.type, req.body.expiryDate || undefined, req.file);
    sendSuccess(res, { document }, { status: 201, message: 'Document uploaded' });
  }),

  listDocuments: asyncHandler(async (req: Request, res: Response) => {
    const documents = await clinicService.listDocuments(req.user!.id, req.user!.role, req.query.clinicId as string);
    sendSuccess(res, { documents });
  }),

  downloadDocument: asyncHandler(async (req: Request, res: Response) => {
    const { doc, absolutePath } = await clinicService.resolveDocumentForDownload(
      req.user!.id,
      req.user!.role,
      req.query.clinicId as string,
      req.params.id as string,
    );
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
    fs.createReadStream(absolutePath).pipe(res);
  }),

  deleteDocument: asyncHandler(async (req: Request, res: Response) => {
    await clinicService.deleteDocument(req.user!.id, req.user!.role, req.query.clinicId as string, req.params.id as string);
    sendSuccess(res, null, { message: 'Document deleted' });
  }),

  updateDocumentExpiry: asyncHandler(async (req: Request, res: Response) => {
    const document = await clinicService.updateDocumentExpiry(req.user!.id, req.user!.role, req.body.clinicId, req.params.id as string, req.body.expiryDate);
    sendSuccess(res, { document }, { message: 'Document expiry updated' });
  }),

  getDashboard: asyncHandler(async (req: Request, res: Response) => {
    const summary = await clinicService.getDashboard(req.user!.id, req.user!.role, req.query.clinicId as string);
    sendSuccess(res, { summary });
  }),
};
