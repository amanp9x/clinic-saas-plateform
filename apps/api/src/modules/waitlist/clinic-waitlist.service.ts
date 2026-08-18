import { CLINIC_PERMISSIONS, SOCKET_EVENTS, type UserRole } from '@clinic/shared';
import type { ClinicWaitlistQuery, ClinicWaitlistRowDto, PaginatedResult, ReceptionJoinWaitlistInput } from '@clinic/shared';
import { waitlistRepository } from './waitlist.repository.js';
import { toClinicWaitlistRowDto } from './waitlist.mappers.js';
import { assertClinicPermission, requireDoctorAtClinic } from '../reception/reception.shared.js';
import { queueEngine } from '../queue-engine/queue-engine.service.js';
import { isUniqueConstraintError } from '../doctor-queue/queue.repository.js';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom } from '../../sockets/emit.js';

function parseTargetDate(targetDate: string): Date {
  const parsed = new Date(`${targetDate}T00:00:00.000Z`);
  const todayUtc = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  if (parsed.getTime() < todayUtc.getTime()) {
    throw new ValidationError('targetDate cannot be in the past');
  }
  return parsed;
}

export const clinicWaitlistService = {
  async list(userId: string, role: UserRole, query: ClinicWaitlistQuery): Promise<PaginatedResult<ClinicWaitlistRowDto>> {
    await assertClinicPermission(userId, role, query.clinicId, CLINIC_PERMISSIONS.QUEUE_VIEW);
    const { items, total } = await waitlistRepository.listForClinic(query.clinicId, {
      doctorId: query.doctorId,
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
    return {
      items: items.map(toClinicWaitlistRowDto),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  },

  /** Reuses the same existing-or-new patient resolution as the walk-in and reception-booking
   * flows — no parallel patient-lookup logic for the waitlist. */
  async add(userId: string, role: UserRole, input: ReceptionJoinWaitlistInput): Promise<ClinicWaitlistRowDto> {
    await assertClinicPermission(userId, role, input.clinicId, CLINIC_PERMISSIONS.APPOINTMENT_MANAGE);
    const targetDate = parseTargetDate(input.targetDate);
    await requireDoctorAtClinic(input.doctorId, input.clinicId);

    const patient = await queueEngine.resolveWalkInPatient({
      existingPatientId: input.patientId,
      fullName: input.newPatient?.fullName,
      phone: input.newPatient?.phone,
      age: input.newPatient?.age,
      gender: input.newPatient?.gender,
    });

    let entry;
    try {
      entry = await waitlistRepository.create({
        patientId: patient.id,
        doctorId: input.doctorId,
        clinicId: input.clinicId,
        targetDate,
        consultationType: input.consultationType,
        notes: input.notes || undefined,
        createdByUserId: userId,
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ConflictError('This patient is already on the waitlist for this doctor on this date');
      }
      throw err;
    }

    recordAuditLog({
      actorUserId: userId,
      action: 'waitlist.joined',
      entityType: 'WaitlistEntry',
      entityId: entry.id,
      clinicId: input.clinicId,
      metadata: { doctorId: input.doctorId, targetDate: input.targetDate, patientId: patient.id, addedByStaff: true },
    });
    emitToClinicRoom(input.clinicId, SOCKET_EVENTS.WAITLIST.JOINED, { waitlistEntryId: entry.id, clinicId: input.clinicId, doctorId: input.doctorId });

    const full = await waitlistRepository.findByIdForClinic(entry.id, input.clinicId);
    return toClinicWaitlistRowDto(full!);
  },

  async cancel(userId: string, role: UserRole, clinicId: string, id: string): Promise<void> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.APPOINTMENT_MANAGE);
    const result = await waitlistRepository.cancel(id, { clinicId }, userId);
    if (result.count === 0) {
      const existing = await waitlistRepository.findByIdForClinic(id, clinicId);
      if (!existing) {
        throw new NotFoundError('Waitlist entry');
      }
      throw new ConflictError('This waitlist entry has already been cancelled or fulfilled');
    }

    recordAuditLog({
      actorUserId: userId,
      action: 'waitlist.cancelled',
      entityType: 'WaitlistEntry',
      entityId: id,
      clinicId,
      metadata: { cancelledByStaff: true },
    });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.WAITLIST.CANCELLED, { waitlistEntryId: id, clinicId });
  },
};
