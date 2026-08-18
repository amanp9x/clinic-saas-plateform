import { SOCKET_EVENTS } from '@clinic/shared';
import type { JoinWaitlistInput, MyWaitlistQuery, PaginatedResult, WaitlistEntryDto } from '@clinic/shared';
import { waitlistRepository } from './waitlist.repository.js';
import { toWaitlistEntryDto } from './waitlist.mappers.js';
import { patientRepository } from '../patient/patient.repository.js';
import { requireDoctorAtClinic } from '../reception/reception.shared.js';
import { isUniqueConstraintError } from '../doctor-queue/queue.repository.js';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom, emitToUserRoom } from '../../sockets/emit.js';

async function resolvePatientId(userId: string): Promise<string> {
  const patient = await patientRepository.findByUserId(userId);
  if (!patient) {
    throw new NotFoundError('Patient profile');
  }
  return patient.id;
}

function parseTargetDate(targetDate: string): Date {
  const parsed = new Date(`${targetDate}T00:00:00.000Z`);
  const todayUtc = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  if (parsed.getTime() < todayUtc.getTime()) {
    throw new ValidationError('targetDate cannot be in the past');
  }
  return parsed;
}

export const waitlistService = {
  async join(userId: string, input: JoinWaitlistInput): Promise<WaitlistEntryDto> {
    const patientId = await resolvePatientId(userId);
    const targetDate = parseTargetDate(input.targetDate);
    // Confirms the doctor is actually active at this clinic — never trusts the client-supplied
    // pairing beyond that check.
    await requireDoctorAtClinic(input.doctorId, input.clinicId);

    let entry;
    try {
      entry = await waitlistRepository.create({
        patientId,
        doctorId: input.doctorId,
        clinicId: input.clinicId,
        targetDate,
        consultationType: input.consultationType,
        notes: input.notes || undefined,
        createdByUserId: userId,
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ConflictError('You are already on the waitlist for this doctor on this date');
      }
      throw err;
    }

    recordAuditLog({
      actorUserId: userId,
      action: 'waitlist.joined',
      entityType: 'WaitlistEntry',
      entityId: entry.id,
      clinicId: input.clinicId,
      metadata: { doctorId: input.doctorId, targetDate: input.targetDate },
    });
    emitToClinicRoom(input.clinicId, SOCKET_EVENTS.WAITLIST.JOINED, { waitlistEntryId: entry.id, clinicId: input.clinicId, doctorId: input.doctorId });

    return toWaitlistEntryDto(entry);
  },

  async listMy(userId: string, query: MyWaitlistQuery): Promise<PaginatedResult<WaitlistEntryDto>> {
    const patientId = await resolvePatientId(userId);
    const { items, total } = await waitlistRepository.listForPatient(patientId, { status: query.status, page: query.page, limit: query.limit });
    return {
      items: items.map(toWaitlistEntryDto),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  },

  async cancel(userId: string, id: string): Promise<void> {
    const patientId = await resolvePatientId(userId);
    const result = await waitlistRepository.cancel(id, { patientId }, userId);
    if (result.count === 0) {
      const existing = await waitlistRepository.findByIdForPatient(id, patientId);
      if (!existing) {
        throw new NotFoundError('Waitlist entry');
      }
      throw new ConflictError('This waitlist entry has already been cancelled or fulfilled');
    }

    const entry = await waitlistRepository.findByIdForPatient(id, patientId);
    recordAuditLog({
      actorUserId: userId,
      action: 'waitlist.cancelled',
      entityType: 'WaitlistEntry',
      entityId: id,
      clinicId: entry?.clinicId,
    });
    if (entry) {
      emitToClinicRoom(entry.clinicId, SOCKET_EVENTS.WAITLIST.CANCELLED, { waitlistEntryId: id, clinicId: entry.clinicId });
      emitToUserRoom(userId, SOCKET_EVENTS.WAITLIST.CANCELLED, { waitlistEntryId: id });
    }
  },
};
