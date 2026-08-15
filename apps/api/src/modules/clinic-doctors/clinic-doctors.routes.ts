import { Router } from 'express';
import {
  UserRole,
  clinicDoctorAssociateSchema,
  clinicDoctorStatusUpdateSchema,
  clinicDoctorUpdateSchema,
  clinicIdQuerySchema,
  clinicPaginationQuerySchema,
  doctorSearchQuerySchema,
  idParamSchema,
} from '@clinic/shared';
import { clinicDoctorsController } from './clinic-doctors.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const clinicDoctorsRouter = Router();

clinicDoctorsRouter.use(authenticate, authorize(UserRole.CLINIC_ADMIN, UserRole.CLINIC_STAFF, UserRole.RECEPTIONIST));

clinicDoctorsRouter.get('/search', validate({ query: doctorSearchQuerySchema }), clinicDoctorsController.search);
clinicDoctorsRouter.get('/', validate({ query: clinicPaginationQuerySchema }), clinicDoctorsController.list);
clinicDoctorsRouter.post('/', validate({ body: clinicDoctorAssociateSchema }), clinicDoctorsController.associate);
clinicDoctorsRouter.get('/:id', validate({ params: idParamSchema, query: clinicIdQuerySchema }), clinicDoctorsController.getById);
clinicDoctorsRouter.patch(
  '/:id',
  validate({ params: idParamSchema, query: clinicIdQuerySchema, body: clinicDoctorUpdateSchema }),
  clinicDoctorsController.update,
);
clinicDoctorsRouter.patch(
  '/:id/status',
  validate({ params: idParamSchema, query: clinicIdQuerySchema, body: clinicDoctorStatusUpdateSchema }),
  clinicDoctorsController.updateStatus,
);
clinicDoctorsRouter.delete('/:id', validate({ params: idParamSchema, query: clinicIdQuerySchema }), clinicDoctorsController.remove);
