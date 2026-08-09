import type { Request, Response } from 'express';
import { patientService } from './patient.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { ValidationError } from '../../utils/app-error.js';

export const patientController = {
  getProfile: asyncHandler(async (req: Request, res: Response) => {
    const profile = await patientService.getProfile(req.user!.id);
    sendSuccess(res, { profile });
  }),

  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    const profile = await patientService.updateProfile(req.user!.id, req.body);
    sendSuccess(res, { profile }, { message: 'Profile updated' });
  }),

  uploadPhoto: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ValidationError('No image file was provided');
    }
    const result = await patientService.uploadProfilePhoto(req.user!.id, req.file);
    sendSuccess(res, result, { message: 'Profile photo updated' });
  }),

  removePhoto: asyncHandler(async (req: Request, res: Response) => {
    await patientService.removeProfilePhoto(req.user!.id);
    sendSuccess(res, null, { message: 'Profile photo removed' });
  }),

  listAddresses: asyncHandler(async (req: Request, res: Response) => {
    const addresses = await patientService.listAddresses(req.user!.id);
    sendSuccess(res, { addresses });
  }),

  createAddress: asyncHandler(async (req: Request, res: Response) => {
    const address = await patientService.createAddress(req.user!.id, req.body);
    sendSuccess(res, { address }, { status: 201, message: 'Address added' });
  }),

  updateAddress: asyncHandler(async (req: Request, res: Response) => {
    const address = await patientService.updateAddress(req.user!.id, req.params.id!, req.body);
    sendSuccess(res, { address }, { message: 'Address updated' });
  }),

  deleteAddress: asyncHandler(async (req: Request, res: Response) => {
    await patientService.deleteAddress(req.user!.id, req.params.id!);
    sendSuccess(res, null, { message: 'Address removed' });
  }),

  requestEmailChange: asyncHandler(async (req: Request, res: Response) => {
    await patientService.requestEmailChange(req.user!.id, req.body.newEmail);
    sendSuccess(res, null, { message: 'Verification code sent to your new email' });
  }),

  confirmEmailChange: asyncHandler(async (req: Request, res: Response) => {
    await patientService.confirmEmailChange(req.user!.id, req.body);
    sendSuccess(res, null, { message: 'Email updated' });
  }),

  requestMobileChange: asyncHandler(async (req: Request, res: Response) => {
    await patientService.requestMobileChange(req.user!.id, req.body.newPhone);
    sendSuccess(res, null, { message: 'Verification code sent to your new phone number' });
  }),

  confirmMobileChange: asyncHandler(async (req: Request, res: Response) => {
    await patientService.confirmMobileChange(req.user!.id, req.body);
    sendSuccess(res, null, { message: 'Phone number updated' });
  }),

  deleteAccount: asyncHandler(async (req: Request, res: Response) => {
    await patientService.deleteAccount(req.user!.id, req.body);
    res.clearCookie('refreshToken', { path: '/api/v1/auth' });
    sendSuccess(res, null, { message: 'Account deleted' });
  }),
};
