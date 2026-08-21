import { CLINIC_PERMISSIONS, SOCKET_EVENTS, type UserRole } from '@clinic/shared';
import type { ClinicDoctorAssociateInput, ClinicDoctorStatusUpdateInput, ClinicDoctorUpdateInput } from '@clinic/shared';
import { clinicDoctorsRepository } from './clinic-doctors.repository.js';
import { toClinicDoctorDetail, toClinicDoctorSummary, toExistingDoctorSearchResult } from './clinic-doctors.mappers.js';
import { assertClinicPermission } from '../reception/reception.shared.js';
import { queueRepository } from '../doctor-queue/queue.repository.js';
import { bookingEngine } from '../booking/booking.engine.js';
import { bookingRepository } from '../booking/booking.repository.js';
import { paymentEngine } from '../payments/payment.engine.js';
import { prisma } from '../../config/database.js';
import { ConflictError, NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom } from '../../sockets/emit.js';

async function sessionFor(doctorId: string, clinicId: string) {
  const session = await queueRepository.findSession(doctorId, clinicId);
  return session ? { status: session.status, queueStatus: session.queueStatus } : null;
}

/** A doctor going non-ACTIVE at a clinic (or the association being removed outright) must not
 * silently orphan appointments already booked with them here — `requireDoctorAtClinic` already
 * blocks *new* bookings the moment `isActive` flips false, but nothing previously cancelled the
 * ones that already exist. `Appointment` has no FK to `ClinicDoctor` (only direct doctorId/clinicId),
 * so deleting or deactivating the association never cascades on its own. This reuses the exact
 * scan-then-atomically-claim-then-cancel core `doctor.service.ts::createLeave` already established
 * (findConflictingAppointments -> per-appointment updateMany-guard -> cancelCore -> refund) rather
 * than inventing a second cancellation path — `far future` stands in for "no end date" since
 * `findConflictingAppointments` takes a bounded range. */
const FAR_FUTURE = new Date('2999-12-31T23:59:59.999Z');

async function cancelFutureAppointmentsAtClinic(doctorId: string, clinicId: string, actorUserId: string, reason: string): Promise<number> {
  const conflicts = await bookingRepository.findConflictingAppointments(doctorId, clinicId, new Date(), FAR_FUTURE);

  let cancelledCount = 0;
  for (const appointment of conflicts) {
    const claim = await prisma.appointment.updateMany({
      where: { id: appointment.id, status: { in: ['PENDING', 'CONFIRMED'] } },
      data: { status: 'CANCELLED' },
    });
    if (claim.count !== 1) continue;

    await bookingEngine.cancelCore(appointment, { reason, actorUserId, source: 'RECEPTION' });
    await paymentEngine.handleAppointmentCancelled(appointment.id, actorUserId);
    cancelledCount++;
  }
  return cancelledCount;
}

export const clinicDoctorsService = {
  async searchExistingDoctors(userId: string, role: UserRole, clinicId: string, q: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.DOCTOR_MANAGE);
    const doctors = await clinicDoctorsRepository.searchDoctors(q);
    const associations = await prisma.clinicDoctor.findMany({ where: { clinicId, doctorId: { in: doctors.map((d) => d.id) } }, select: { doctorId: true } });
    const associatedIds = new Set(associations.map((a) => a.doctorId));
    return doctors.map((d) => toExistingDoctorSearchResult(d, associatedIds.has(d.id)));
  },

  async list(userId: string, role: UserRole, clinicId: string, q: string | undefined, page: number, limit: number) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.DOCTOR_VIEW);
    const { items, total } = await clinicDoctorsRepository.list(clinicId, q, page, limit);
    const mapped = await Promise.all(items.map(async (a) => toClinicDoctorSummary(a, await sessionFor(a.doctorId, clinicId))));
    return { items: mapped, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },

  async getById(userId: string, role: UserRole, clinicId: string, clinicDoctorId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.DOCTOR_VIEW);
    const assoc = await clinicDoctorsRepository.findAssociationById(clinicDoctorId, clinicId);
    if (!assoc) throw new NotFoundError('Doctor association');
    return toClinicDoctorDetail(assoc, await sessionFor(assoc.doctorId, clinicId));
  },

  async associate(userId: string, role: UserRole, clinicId: string, input: ClinicDoctorAssociateInput) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.DOCTOR_MANAGE);

    const doctor = await prisma.doctor.findUnique({ where: { id: input.doctorId } });
    if (!doctor) throw new NotFoundError('Doctor');

    const existing = await clinicDoctorsRepository.findAssociation(clinicId, input.doctorId);
    if (existing) {
      throw new ConflictError('This doctor is already associated with this clinic');
    }

    const created = await clinicDoctorsRepository.create({
      clinicId,
      doctorId: input.doctorId,
      departmentId: input.departmentId ?? undefined,
      consultationFeeOverride: input.consultationFeeOverride ?? undefined,
      consultationDurationMinutesOverride: input.consultationDurationMinutesOverride ?? undefined,
      consultationTypes: input.consultationTypes,
      timings: input.timings ?? undefined,
      availableDays: input.availableDays ?? [],
      startDate: input.startDate ? new Date(input.startDate) : undefined,
    });

    recordAuditLog({ actorUserId: userId, action: 'clinic.doctor_associated', entityType: 'ClinicDoctor', entityId: created.id, clinicId, metadata: { doctorId: input.doctorId } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.DOCTOR_ASSOCIATION.UPDATED, { clinicId, doctorId: input.doctorId });
    return toClinicDoctorDetail(created, null);
  },

  async update(userId: string, role: UserRole, clinicId: string, clinicDoctorId: string, input: ClinicDoctorUpdateInput) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.DOCTOR_MANAGE);
    const assoc = await clinicDoctorsRepository.findAssociationById(clinicDoctorId, clinicId);
    if (!assoc) throw new NotFoundError('Doctor association');

    const updated = await clinicDoctorsRepository.update(clinicDoctorId, {
      department: input.departmentId !== undefined ? (input.departmentId ? { connect: { id: input.departmentId } } : { disconnect: true }) : undefined,
      consultationFeeOverride: input.consultationFeeOverride,
      consultationDurationMinutesOverride: input.consultationDurationMinutesOverride,
      consultationTypes: input.consultationTypes,
      timings: input.timings,
      availableDays: input.availableDays,
      isAcceptingAppointments: input.isAcceptingAppointments,
      queueEnabled: input.queueEnabled,
      canOverrideDelay: input.canOverrideDelay,
      startDate: input.startDate !== undefined ? (input.startDate ? new Date(input.startDate) : null) : undefined,
      endDate: input.endDate !== undefined ? (input.endDate ? new Date(input.endDate) : null) : undefined,
    });

    recordAuditLog({ actorUserId: userId, action: 'clinic.doctor_association_updated', entityType: 'ClinicDoctor', entityId: clinicDoctorId, clinicId, metadata: { fields: Object.keys(input) } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.DOCTOR_ASSOCIATION.UPDATED, { clinicId, doctorId: assoc.doctorId });
    return toClinicDoctorDetail(updated, await sessionFor(assoc.doctorId, clinicId));
  },

  async updateStatus(userId: string, role: UserRole, clinicId: string, clinicDoctorId: string, input: ClinicDoctorStatusUpdateInput) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.DOCTOR_MANAGE);
    const assoc = await clinicDoctorsRepository.findAssociationById(clinicDoctorId, clinicId);
    if (!assoc) throw new NotFoundError('Doctor association');

    const updated = await clinicDoctorsRepository.update(clinicDoctorId, {
      status: input.status,
      isActive: input.status === 'ACTIVE',
    });

    emitToClinicRoom(clinicId, SOCKET_EVENTS.DOCTOR_ASSOCIATION.UPDATED, { clinicId, doctorId: assoc.doctorId });

    // Going non-ACTIVE (from any previous status, including re-confirming an already-non-ACTIVE
    // one) must never leave a booked appointment behind — re-running this is always safe: once no
    // PENDING/CONFIRMED rows remain for this doctor+clinic, the scan simply finds nothing.
    let cancelledAppointmentCount = 0;
    if (input.status !== 'ACTIVE') {
      cancelledAppointmentCount = await cancelFutureAppointmentsAtClinic(
        assoc.doctorId,
        clinicId,
        userId,
        input.reason?.trim() || 'This doctor is no longer available at this clinic',
      );
    }

    recordAuditLog({
      actorUserId: userId,
      action: 'clinic.doctor_status_updated',
      entityType: 'ClinicDoctor',
      entityId: clinicDoctorId,
      clinicId,
      metadata: { previousState: { status: assoc.status }, newState: { status: input.status }, cancelledAppointmentCount },
    });

    return { doctor: toClinicDoctorDetail(updated, await sessionFor(assoc.doctorId, clinicId)), cancelledAppointmentCount };
  },

  async remove(userId: string, role: UserRole, clinicId: string, clinicDoctorId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.DOCTOR_MANAGE);
    const assoc = await clinicDoctorsRepository.findAssociationById(clinicDoctorId, clinicId);
    if (!assoc) throw new NotFoundError('Doctor association');

    // Cancel before deleting the association row — the cascade needs the doctorId/clinicId pair,
    // and cancelling first (rather than after) means a crash mid-way never leaves the association
    // gone while a stale appointment still looks legitimately bookable.
    const cancelledAppointmentCount = await cancelFutureAppointmentsAtClinic(assoc.doctorId, clinicId, userId, 'Doctor removed from this clinic');

    await clinicDoctorsRepository.remove(clinicDoctorId);

    recordAuditLog({
      actorUserId: userId,
      action: 'clinic.doctor_association_removed',
      entityType: 'ClinicDoctor',
      entityId: clinicDoctorId,
      clinicId,
      metadata: { doctorId: assoc.doctorId, cancelledAppointmentCount },
    });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.DOCTOR_ASSOCIATION.UPDATED, { clinicId, doctorId: assoc.doctorId });
    return { cancelledAppointmentCount };
  },
};
