import { Router } from 'express';
import { UserRole, clinicIdQuerySchema, clinicPaginationQuerySchema, departmentCreateSchema, departmentUpdateSchema, idParamSchema } from '@clinic/shared';
import { clinicDepartmentsController } from './clinic-departments.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const clinicDepartmentsRouter = Router();

clinicDepartmentsRouter.use(authenticate, authorize(UserRole.CLINIC_ADMIN, UserRole.CLINIC_STAFF, UserRole.RECEPTIONIST));

clinicDepartmentsRouter.get('/', validate({ query: clinicPaginationQuerySchema }), clinicDepartmentsController.list);
clinicDepartmentsRouter.post('/', validate({ body: departmentCreateSchema }), clinicDepartmentsController.create);
clinicDepartmentsRouter.patch(
  '/:id',
  validate({ params: idParamSchema, query: clinicIdQuerySchema, body: departmentUpdateSchema }),
  clinicDepartmentsController.update,
);
clinicDepartmentsRouter.delete('/:id', validate({ params: idParamSchema, query: clinicIdQuerySchema }), clinicDepartmentsController.remove);
