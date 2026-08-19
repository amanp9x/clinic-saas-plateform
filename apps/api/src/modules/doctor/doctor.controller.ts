import type { Request, Response } from 'express';
import { doctorService } from './doctor.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { ValidationError } from '../../utils/app-error.js';

export const doctorController = {
  getDashboard: asyncHandler(async (req: Request, res: Response) => {
    const summary = await doctorService.getDashboard(req.user!.id);
    sendSuccess(res, { summary });
  }),

  getProfile: asyncHandler(async (req: Request, res: Response) => {
    const profile = await doctorService.getProfile(req.user!.id);
    sendSuccess(res, { profile });
  }),

  updateProfile: asyncHandler(async (req: Request, res: Response) => {
    const profile = await doctorService.updateProfile(req.user!.id, req.body);
    sendSuccess(res, { profile }, { message: 'Profile updated' });
  }),

  uploadPhoto: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ValidationError('No image file was provided');
    }
    const result = await doctorService.uploadProfilePhoto(req.user!.id, req.file);
    sendSuccess(res, result, { message: 'Profile photo updated' });
  }),

  removePhoto: asyncHandler(async (req: Request, res: Response) => {
    await doctorService.removeProfilePhoto(req.user!.id);
    sendSuccess(res, null, { message: 'Profile photo removed' });
  }),

  listClinics: asyncHandler(async (req: Request, res: Response) => {
    const clinics = await doctorService.listClinics(req.user!.id);
    sendSuccess(res, { clinics });
  }),

  updateClinicAssociation: asyncHandler(async (req: Request, res: Response) => {
    const clinic = await doctorService.updateClinicAssociation(req.user!.id, req.params.clinicId!, req.body);
    sendSuccess(res, { clinic }, { message: 'Clinic settings updated' });
  }),

  listSchedule: asyncHandler(async (req: Request, res: Response) => {
    const slots = await doctorService.listSchedule(req.user!.id);
    sendSuccess(res, { slots });
  }),

  createScheduleSlot: asyncHandler(async (req: Request, res: Response) => {
    const slot = await doctorService.createScheduleSlot(req.user!.id, req.body);
    sendSuccess(res, { slot }, { status: 201, message: 'Schedule slot added' });
  }),

  updateScheduleSlot: asyncHandler(async (req: Request, res: Response) => {
    const slot = await doctorService.updateScheduleSlot(req.user!.id, req.params.id!, req.body);
    sendSuccess(res, { slot }, { message: 'Schedule slot updated' });
  }),

  deleteScheduleSlot: asyncHandler(async (req: Request, res: Response) => {
    await doctorService.deleteScheduleSlot(req.user!.id, req.params.id!);
    sendSuccess(res, null, { message: 'Schedule slot removed' });
  }),

  listLeaves: asyncHandler(async (req: Request, res: Response) => {
    const leaves = await doctorService.listLeaves(req.user!.id);
    sendSuccess(res, { leaves });
  }),

  createLeave: asyncHandler(async (req: Request, res: Response) => {
    const { leave, cancelledAppointments } = await doctorService.createLeave(req.user!.id, req.body);
    const message = cancelledAppointments.length > 0
      ? `Leave added — ${cancelledAppointments.length} appointment${cancelledAppointments.length === 1 ? '' : 's'} cancelled and patient${cancelledAppointments.length === 1 ? '' : 's'} notified`
      : 'Leave added';
    sendSuccess(res, { leave, cancelledAppointments }, { status: 201, message });
  }),

  deleteLeave: asyncHandler(async (req: Request, res: Response) => {
    await doctorService.deleteLeave(req.user!.id, req.params.id!);
    sendSuccess(res, null, { message: 'Leave removed' });
  }),

  getStatus: asyncHandler(async (req: Request, res: Response) => {
    const sessions = await doctorService.getStatus(req.user!.id);
    sendSuccess(res, { sessions });
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const session = await doctorService.updateStatus(req.user!.id, req.body.clinicId, req.body.status);
    sendSuccess(res, { session }, { message: 'Status updated' });
  }),

  getEarnings: asyncHandler(async (req: Request, res: Response) => {
    const earnings = await doctorService.getEarnings(req.user!.id, req.query as never);
    sendSuccess(res, { earnings });
  }),

  listReviews: asyncHandler(async (req: Request, res: Response) => {
    const reviews = await doctorService.listReviews(req.user!.id);
    sendSuccess(res, { reviews });
  }),

  respondToReview: asyncHandler(async (req: Request, res: Response) => {
    const review = await doctorService.respondToReview(req.user!.id, req.params.id!, req.body);
    sendSuccess(res, { review }, { message: 'Response posted' });
  }),

  listWaitlist: asyncHandler(async (req: Request, res: Response) => {
    const result = await doctorService.listWaitlist(req.user!.id, req.query as never);
    sendSuccess(res, result);
  }),

  listFollowUps: asyncHandler(async (req: Request, res: Response) => {
    const result = await doctorService.listFollowUps(req.user!.id, req.query as never);
    sendSuccess(res, result);
  }),
};
