import { Router } from 'express';
import {
  clinicSearchSchema,
  clinicSlugParamSchema,
  doctorQueueQuerySchema,
  doctorSearchSchema,
  doctorSlugParamSchema,
  hospitalSearchSchema,
  previewLimitSchema,
  specializationSlugParamSchema,
} from '@clinic/shared';
import { catalogController } from './catalog.controller.js';
import { validate } from '../../middleware/validate.js';

export const catalogRouter = Router();

catalogRouter.get('/specializations', catalogController.listSpecializations);
catalogRouter.get(
  '/specializations/:slug',
  validate({ params: specializationSlugParamSchema }),
  catalogController.getSpecialization,
);
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
  '/doctors/:slug/queue',
  validate({ params: doctorSlugParamSchema, query: doctorQueueQuerySchema }),
  catalogController.getDoctorQueue,
);

catalogRouter.get(
  '/clinics',
  validate({ query: clinicSearchSchema }),
  catalogController.searchClinics,
);
catalogRouter.get(
  '/clinics/:slug',
  validate({ params: clinicSlugParamSchema }),
  catalogController.getClinic,
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
