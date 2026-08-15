import { Router } from 'express';
import { UserRole, clinicIdQuerySchema, idParamSchema, resourceCreateSchema, resourceUpdateSchema } from '@clinic/shared';
import { clinicResourcesController } from './clinic-resources.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const clinicResourcesRouter = Router();

clinicResourcesRouter.use(authenticate, authorize(UserRole.CLINIC_ADMIN, UserRole.CLINIC_STAFF, UserRole.RECEPTIONIST));

clinicResourcesRouter.get('/', validate({ query: clinicIdQuerySchema }), clinicResourcesController.list);
clinicResourcesRouter.post('/', validate({ body: resourceCreateSchema }), clinicResourcesController.create);
clinicResourcesRouter.patch(
  '/:id',
  validate({ params: idParamSchema, query: clinicIdQuerySchema, body: resourceUpdateSchema }),
  clinicResourcesController.update,
);
clinicResourcesRouter.delete('/:id', validate({ params: idParamSchema, query: clinicIdQuerySchema }), clinicResourcesController.remove);
