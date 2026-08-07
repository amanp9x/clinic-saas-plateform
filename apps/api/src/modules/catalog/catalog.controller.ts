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

  listSpecializations: asyncHandler(async (_req: Request, res: Response) => {
    const specializations = await catalogService.listSpecializations();
    sendSuccess(res, { specializations });
  }),

  searchClinics: asyncHandler(async (req: Request, res: Response) => {
    const result = await catalogService.searchClinics(req.query as never);
    sendSuccess(res, result);
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
