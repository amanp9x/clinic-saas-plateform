import type { Request, Response } from 'express';
import { favoritesService } from './favorites.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const favoritesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await favoritesService.list(req.user!.id);
    sendSuccess(res, result);
  }),

  saveDoctor: asyncHandler(async (req: Request, res: Response) => {
    const favorite = await favoritesService.addDoctorFavorite(req.user!.id, req.params.doctorId!);
    sendSuccess(res, favorite, { status: 201 });
  }),

  removeDoctor: asyncHandler(async (req: Request, res: Response) => {
    await favoritesService.removeDoctorFavorite(req.user!.id, req.params.doctorId!);
    sendSuccess(res, null);
  }),

  saveClinic: asyncHandler(async (req: Request, res: Response) => {
    const favorite = await favoritesService.addClinicFavorite(req.user!.id, req.params.clinicId!);
    sendSuccess(res, favorite, { status: 201 });
  }),

  removeClinic: asyncHandler(async (req: Request, res: Response) => {
    await favoritesService.removeClinicFavorite(req.user!.id, req.params.clinicId!);
    sendSuccess(res, null);
  }),
};
