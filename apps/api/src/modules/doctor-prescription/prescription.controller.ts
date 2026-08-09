import type { Request, Response } from 'express';
import { prescriptionService } from './prescription.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { ValidationError } from '../../utils/app-error.js';

export const prescriptionController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await prescriptionService.list(req.user!.id, req.query as never);
    sendSuccess(res, result);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const prescription = await prescriptionService.getById(req.user!.id, req.params.id!);
    sendSuccess(res, { prescription });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const prescription = await prescriptionService.create(req.user!.id, req.body);
    sendSuccess(res, { prescription }, { status: 201, message: 'Prescription draft created' });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const prescription = await prescriptionService.update(req.user!.id, req.params.id!, req.body);
    sendSuccess(res, { prescription }, { message: 'Prescription updated' });
  }),

  finalize: asyncHandler(async (req: Request, res: Response) => {
    const prescription = await prescriptionService.finalize(req.user!.id, req.params.id!);
    sendSuccess(res, { prescription }, { message: 'Prescription finalized' });
  }),

  getPdf: asyncHandler(async (req: Request, res: Response) => {
    const { buffer, filename } = await prescriptionService.getPdfFile(req.user!.id, req.params.id!);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  }),

  getSignature: asyncHandler(async (req: Request, res: Response) => {
    const signature = await prescriptionService.getSignature(req.user!.id);
    sendSuccess(res, { signature });
  }),

  updateSignatureText: asyncHandler(async (req: Request, res: Response) => {
    const signature = await prescriptionService.updateSignatureText(req.user!.id, req.body);
    sendSuccess(res, { signature }, { message: 'Signature updated' });
  }),

  uploadSignatureImage: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ValidationError('No image file was provided');
    }
    const signature = await prescriptionService.uploadSignatureImage(req.user!.id, req.file);
    sendSuccess(res, { signature }, { message: 'Signature image updated' });
  }),

  removeSignatureImage: asyncHandler(async (req: Request, res: Response) => {
    await prescriptionService.removeSignatureImage(req.user!.id);
    sendSuccess(res, null, { message: 'Signature image removed' });
  }),
};
