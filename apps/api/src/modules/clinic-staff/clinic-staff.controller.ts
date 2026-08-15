import type { Request, Response } from 'express';
import { clinicStaffService } from './clinic-staff.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const clinicStaffController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as { clinicId: string; q?: string; role?: never; page: number; limit: number };
    const staff = await clinicStaffService.list(req.user!.id, req.user!.role, query.clinicId, query.q, req.query.role as never, query.page, query.limit);
    sendSuccess(res, { staff });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const staffMember = await clinicStaffService.getById(req.user!.id, req.user!.role, req.query.clinicId as string, req.params.id as string);
    sendSuccess(res, { staffMember });
  }),

  updateRole: asyncHandler(async (req: Request, res: Response) => {
    const staffMember = await clinicStaffService.updateRole(req.user!.id, req.user!.role, req.query.clinicId as string, req.params.id as string, req.body);
    sendSuccess(res, { staffMember }, { message: 'Staff role updated' });
  }),

  updatePermissions: asyncHandler(async (req: Request, res: Response) => {
    const staffMember = await clinicStaffService.updatePermissions(req.user!.id, req.user!.role, req.query.clinicId as string, req.params.id as string, req.body);
    sendSuccess(res, { staffMember }, { message: 'Staff permissions updated' });
  }),

  activate: asyncHandler(async (req: Request, res: Response) => {
    const staffMember = await clinicStaffService.updateStatus(req.user!.id, req.user!.role, req.query.clinicId as string, req.params.id as string, true);
    sendSuccess(res, { staffMember }, { message: 'Staff member activated' });
  }),

  deactivate: asyncHandler(async (req: Request, res: Response) => {
    const staffMember = await clinicStaffService.updateStatus(req.user!.id, req.user!.role, req.query.clinicId as string, req.params.id as string, false);
    sendSuccess(res, { staffMember }, { message: 'Staff member deactivated' });
  }),

  revoke: asyncHandler(async (req: Request, res: Response) => {
    await clinicStaffService.revoke(req.user!.id, req.user!.role, req.query.clinicId as string, req.params.id as string);
    sendSuccess(res, null, { message: 'Staff access revoked' });
  }),

  invite: asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, ...input } = req.body;
    const invitation = await clinicStaffService.invite(req.user!.id, req.user!.role, clinicId, input);
    sendSuccess(res, { invitation }, { status: 201, message: 'Invitation sent' });
  }),

  listInvitations: asyncHandler(async (req: Request, res: Response) => {
    const invitations = await clinicStaffService.listInvitations(req.user!.id, req.user!.role, req.query.clinicId as string);
    sendSuccess(res, { invitations });
  }),

  revokeInvitation: asyncHandler(async (req: Request, res: Response) => {
    const invitation = await clinicStaffService.revokeInvitation(req.user!.id, req.user!.role, req.query.clinicId as string, req.params.id as string);
    sendSuccess(res, { invitation }, { message: 'Invitation revoked' });
  }),

  acceptInvitation: asyncHandler(async (req: Request, res: Response) => {
    const staffMember = await clinicStaffService.acceptInvitation(req.body);
    sendSuccess(res, { staffMember }, { status: 201, message: 'Invitation accepted — you can now log in' });
  }),
};
