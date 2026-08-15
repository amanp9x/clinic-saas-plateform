import { Router } from 'express';
import { favoriteClinicParamSchema, favoriteDoctorParamSchema, UserRole } from '@clinic/shared';
import { favoritesController } from './favorites.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const favoritesRouter = Router();

favoritesRouter.use(authenticate, authorize(UserRole.PATIENT));

favoritesRouter.get('/', favoritesController.list);
favoritesRouter.post(
  '/doctors/:doctorId',
  validate({ params: favoriteDoctorParamSchema }),
  favoritesController.saveDoctor,
);
favoritesRouter.delete(
  '/doctors/:doctorId',
  validate({ params: favoriteDoctorParamSchema }),
  favoritesController.removeDoctor,
);
favoritesRouter.post(
  '/clinics/:clinicId',
  validate({ params: favoriteClinicParamSchema }),
  favoritesController.saveClinic,
);
favoritesRouter.delete(
  '/clinics/:clinicId',
  validate({ params: favoriteClinicParamSchema }),
  favoritesController.removeClinic,
);
