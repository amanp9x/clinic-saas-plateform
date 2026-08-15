import { CLINIC_PERMISSIONS, SOCKET_EVENTS, type UserRole } from '@clinic/shared';
import type { BlockedSlotCreateInput } from '@clinic/shared';
import type { BlockedSlotDto } from '@clinic/shared';
import { prisma } from '../../config/database.js';
import { NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom } from '../../sockets/emit.js';
import { assertClinicPermission } from '../reception/reception.shared.js';
import { resolveDoctorOrThrow, assertClinicMembership } from '../doctor/doctor.shared.js';

/** Doctors may only block their own slots at a clinic they belong to; clinic staff with
 * APPOINTMENT_MANAGE may block clinic-wide or for any doctor at their clinic. */
async function assertCanManageBlock(userId: string, role: UserRole, clinicId: string, doctorId?: string | null): Promise<void> {
  if (role === 'DOCTOR') {
    const doctor = await resolveDoctorOrThrow(userId);
    if (doctorId && doctorId !== doctor.id) {
      throw new NotFoundError('Doctor at this clinic');
    }
    await assertClinicMembership(doctor.id, clinicId);
    return;
  }
  await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.APPOINTMENT_MANAGE);
}

function toDto(b: { id: string; doctorId: string | null; clinicId: string; startAt: Date; endAt: Date; reason: string; isActive: boolean }): BlockedSlotDto {
  return {
    id: b.id,
    doctorId: b.doctorId,
    clinicId: b.clinicId,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    reason: b.reason,
    isActive: b.isActive,
  };
}

export const blockedSlotsService = {
  async create(userId: string, role: UserRole, input: BlockedSlotCreateInput): Promise<BlockedSlotDto> {
    await assertCanManageBlock(userId, role, input.clinicId, input.doctorId);

    const block = await prisma.blockedSlot.create({
      data: {
        doctorId: input.doctorId ?? null,
        clinicId: input.clinicId,
        startAt: new Date(input.startAt),
        endAt: new Date(input.endAt),
        reason: input.reason,
        createdByUserId: userId,
      },
    });

    recordAuditLog({
      actorUserId: userId,
      action: 'slot.blocked',
      entityType: 'BlockedSlot',
      entityId: block.id,
      clinicId: input.clinicId,
      metadata: { doctorId: input.doctorId ?? null, startAt: input.startAt, endAt: input.endAt, reason: input.reason },
    });
    emitToClinicRoom(input.clinicId, SOCKET_EVENTS.SLOT.UPDATED, {
      clinicId: input.clinicId,
      doctorId: input.doctorId ?? null,
      startAt: input.startAt,
      endAt: input.endAt,
    });

    return toDto(block);
  },

  async list(userId: string, role: UserRole, clinicId: string, doctorId?: string): Promise<BlockedSlotDto[]> {
    await assertCanManageBlock(userId, role, clinicId, doctorId);
    const blocks = await prisma.blockedSlot.findMany({
      where: { clinicId, isActive: true, ...(doctorId ? { OR: [{ doctorId }, { doctorId: null }] } : {}) },
      orderBy: { startAt: 'asc' },
    });
    return blocks.map(toDto);
  },

  async unblock(userId: string, role: UserRole, clinicId: string, id: string): Promise<void> {
    const block = await prisma.blockedSlot.findUnique({ where: { id } });
    if (!block || block.clinicId !== clinicId) {
      throw new NotFoundError('Blocked slot');
    }
    await assertCanManageBlock(userId, role, clinicId, block.doctorId);

    await prisma.blockedSlot.update({
      where: { id },
      data: { isActive: false, unblockedAt: new Date(), unblockedByUserId: userId },
    });

    recordAuditLog({
      actorUserId: userId,
      action: 'slot.unblocked',
      entityType: 'BlockedSlot',
      entityId: id,
      clinicId,
      metadata: { doctorId: block.doctorId },
    });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.SLOT.UPDATED, { clinicId, doctorId: block.doctorId, startAt: block.startAt.toISOString(), endAt: block.endAt.toISOString() });
  },
};
