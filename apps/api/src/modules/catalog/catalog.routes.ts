import { Router } from 'express';
import {
  clinicSearchSchema,
  doctorSearchSchema,
  doctorSlugParamSchema,
  hospitalSearchSchema,
  previewLimitSchema,
} from '@clinic/shared';
import { catalogController } from './catalog.controller.js';
import { validate } from '../../middleware/validate.js';

export const catalogRouter = Router();

catalogRouter.get('/specializations', catalogController.listSpecializations);
catalogRouter.get('/cities', catalogController.listCities);

catalogRouter.get(
  '/doctors',
  validate({ query: doctorSearchSchema }),
  catalogController.searchDoctors,
);
catalogRouter.get(
  '/doctors/:slug',
  validate({ params: doctorSlugParamSchema }),
  catalogController.getDoctor,
);

catalogRouter.get(
  '/clinics',
  validate({ query: clinicSearchSchema }),
  catalogController.searchClinics,
);
catalogRouter.get(
  '/hospitals',
  validate({ query: hospitalSearchSchema }),
  catalogController.searchHospitals,
);

catalogRouter.get(
  '/testimonials',
  validate({ query: previewLimitSchema }),
  catalogController.listTestimonials,
);
catalogRouter.get(
  '/articles',
  validate({ query: previewLimitSchema }),
  catalogController.listArticles,
);
