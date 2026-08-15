import { Router } from 'express';
import {
  UserRole,
  clinicIdQuerySchema,
  idParamSchema,
  staffInviteAcceptSchema,
  staffInviteSchema,
  staffListQuerySchema,
  staffPermissionsUpdateSchema,
  staffRoleUpdateSchema,
} from '@clinic/shared';
import { clinicStaffController } from './clinic-staff.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const clinicStaffRouter = Router();

// Public — the invitee has no session yet. Must be registered before the auth gate below.
clinicStaffRouter.post('/invitations/accept', validate({ body: staffInviteAcceptSchema }), clinicStaffController.acceptInvitation);

clinicStaffRouter.use(authenticate, authorize(UserRole.CLINIC_ADMIN, UserRole.CLINIC_STAFF, UserRole.RECEPTIONIST));

clinicStaffRouter.get('/', validate({ query: staffListQuerySchema }), clinicStaffController.list);
clinicStaffRouter.get('/invitations', validate({ query: clinicIdQuerySchema }), clinicStaffController.listInvitations);
clinicStaffRouter.post('/invitations', validate({ body: staffInviteSchema }), clinicStaffController.invite);
clinicStaffRouter.delete(
  '/invitations/:id',
  validate({ params: idParamSchema, query: clinicIdQuerySchema }),
  clinicStaffController.revokeInvitation,
);

clinicStaffRouter.get('/:id', validate({ params: idParamSchema, query: clinicIdQuerySchema }), clinicStaffController.getById);
clinicStaffRouter.patch(
  '/:id/role',
  validate({ params: idParamSchema, query: clinicIdQuerySchema, body: staffRoleUpdateSchema }),
  clinicStaffController.updateRole,
);
clinicStaffRouter.patch(
  '/:id/permissions',
  validate({ params: idParamSchema, query: clinicIdQuerySchema, body: staffPermissionsUpdateSchema }),
  clinicStaffController.updatePermissions,
);
clinicStaffRouter.post('/:id/activate', validate({ params: idParamSchema, query: clinicIdQuerySchema }), clinicStaffController.activate);
clinicStaffRouter.post('/:id/deactivate', validate({ params: idParamSchema, query: clinicIdQuerySchema }), clinicStaffController.deactivate);
clinicStaffRouter.delete('/:id', validate({ params: idParamSchema, query: clinicIdQuerySchema }), clinicStaffController.revoke);
