import type { Request, Response } from 'express';
import type { ClinicAuditLogQuery } from '@clinic/shared';
import { clinicAuditService } from './clinic-audit.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const clinicAuditController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as ClinicAuditLogQuery;
    const auditLog = await clinicAuditService.list(
      req.user!.id,
      req.user!.role,
      query.clinicId,
      { from: query.from, to: query.to, actorUserId: query.actorUserId, action: query.action, entityType: query.entityType, entityId: query.entityId },
      query.page,
      query.limit,
    );
    sendSuccess(res, { auditLog });
  }),
};
