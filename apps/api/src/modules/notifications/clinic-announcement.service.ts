import type { AppointmentStatus } from '@prisma/client';
import { CLINIC_PERMISSIONS, type ClinicAnnouncementInput, type UserRole } from '@clinic/shared';
import { prisma } from '../../config/database.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { assertClinicPermission } from '../reception/reception.shared.js';
import { notifyUser } from './notification-dispatch.service.js';

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = ['PENDING', 'CONFIRMED', 'CHECKED_IN'];

/**
 * Authorized fan-out only — never returns a patient list to the caller, never accepts recipient
 * ids from the client. The audience is resolved server-side from the clinic's own active
 * appointment data, and each recipient only ever sees the one notification addressed to them.
 */
export const clinicAnnouncementService = {
  async create(userId: string, role: UserRole, input: ClinicAnnouncementInput): Promise<{ recipientCount: number }> {
    await assertClinicPermission(userId, role, input.clinicId, CLINIC_PERMISSIONS.NOTIFICATION_ANNOUNCE);

    const recipientUserIds =
      input.audience === 'STAFF'
        ? (await prisma.clinicStaffMember.findMany({ where: { clinicId: input.clinicId, isActive: true }, select: { userId: true } })).map((s) => s.userId)
        : (
            await prisma.patient.findMany({
              where: { appointments: { some: { clinicId: input.clinicId, status: { in: ACTIVE_APPOINTMENT_STATUSES } } } },
              select: { userId: true },
              distinct: ['userId'],
            })
          ).map((p) => p.userId);

    await Promise.all(
      recipientUserIds.map((recipientUserId) =>
        notifyUser({
          userId: recipientUserId,
          type: 'CLINIC_ANNOUNCEMENT',
          title: input.title,
          message: input.message,
          relatedEntityType: 'Clinic',
          relatedEntityId: input.clinicId,
        }),
      ),
    );

    recordAuditLog({
      actorUserId: userId,
      action: 'notification.announcement_created',
      entityType: 'Clinic',
      entityId: input.clinicId,
      clinicId: input.clinicId,
      metadata: { audience: input.audience, recipientCount: recipientUserIds.length, title: input.title },
    });

    return { recipientCount: recipientUserIds.length };
  },
};
