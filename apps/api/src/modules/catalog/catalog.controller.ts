import type { Request, Response } from 'express';
import { catalogService } from './catalog.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const catalogController = {
  searchDoctors: asyncHandler(async (req: Request, res: Response) => {
    const result = await catalogService.searchDoctors(req.query as never);
    sendSuccess(res, result);
  }),

  getDoctor: asyncHandler(async (req: Request, res: Response) => {
    const result = await catalogService.getDoctorBySlug(req.params.slug!);
    sendSuccess(res, result);
  }),

  getDoctorQueue: asyncHandler(async (req: Request, res: Response) => {
    const { clinicId } = req.query as never as { clinicId: string };
    const status = await catalogService.getDoctorQueueStatus(req.params.slug!, clinicId);
    sendSuccess(res, status);
  }),

  listSpecializations: asyncHandler(async (_req: Request, res: Response) => {
    const specializations = await catalogService.listSpecializations();
    sendSuccess(res, { specializations });
  }),

  getSpecialization: asyncHandler(async (req: Request, res: Response) => {
    const specialization = await catalogService.getSpecializationBySlug(req.params.slug!);
    sendSuccess(res, specialization);
  }),

  searchClinics: asyncHandler(async (req: Request, res: Response) => {
    const result = await catalogService.searchClinics(req.query as never);
    sendSuccess(res, result);
  }),

  getClinic: asyncHandler(async (req: Request, res: Response) => {
    const clinic = await catalogService.getClinicBySlug(req.params.slug!);
    sendSuccess(res, clinic);
  }),

  searchHospitals: asyncHandler(async (req: Request, res: Response) => {
    const result = await catalogService.searchHospitals(req.query as never);
    sendSuccess(res, result);
  }),

  listTestimonials: asyncHandler(async (req: Request, res: Response) => {
    const { limit } = req.query as never as { limit: number };
    const testimonials = await catalogService.listTestimonials(limit);
    sendSuccess(res, { testimonials });
  }),

  listArticles: asyncHandler(async (req: Request, res: Response) => {
    const { limit } = req.query as never as { limit: number };
    const articles = await catalogService.listArticles(limit);
    sendSuccess(res, { articles });
  }),

  listCities: asyncHandler(async (_req: Request, res: Response) => {
    const cities = await catalogService.listCities();
    sendSuccess(res, { cities });
  }),
};
