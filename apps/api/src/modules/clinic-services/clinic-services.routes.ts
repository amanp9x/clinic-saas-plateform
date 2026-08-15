import { Router } from 'express';
import { UserRole, clinicIdQuerySchema, clinicPaginationQuerySchema, idParamSchema, serviceCreateSchema, serviceUpdateSchema } from '@clinic/shared';
import { clinicServicesController } from './clinic-services.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const clinicServicesRouter = Router();

clinicServicesRouter.use(authenticate, authorize(UserRole.CLINIC_ADMIN, UserRole.CLINIC_STAFF, UserRole.RECEPTIONIST));

clinicServicesRouter.get('/', validate({ query: clinicPaginationQuerySchema }), clinicServicesController.list);
clinicServicesRouter.post('/', validate({ body: serviceCreateSchema }), clinicServicesController.create);
clinicServicesRouter.patch(
  '/:id',
  validate({ params: idParamSchema, query: clinicIdQuerySchema, body: serviceUpdateSchema }),
  clinicServicesController.update,
);
clinicServicesRouter.delete('/:id', validate({ params: idParamSchema, query: clinicIdQuerySchema }), clinicServicesController.remove);
