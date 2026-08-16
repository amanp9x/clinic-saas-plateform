import { CLINIC_PERMISSIONS, type UserRole } from '@clinic/shared';
import type {
  BookingConfirmationDto,
  PaginatedResult,
  PatientQuickViewDto,
  PatientSearchResultDto,
  ReceptionAppointmentDetailDto,
  ReceptionAppointmentListQuery,
  ReceptionAppointmentSummaryDto,
  ReceptionCancelAppointmentInput,
  ReceptionCreateAppointmentInput,
  RescheduleAppointmentInput,
} from '@clinic/shared';
import type { TokenPriority, TokenStatus } from '@prisma/client';
import { receptionAppointmentsRepository } from './reception-appointments.repository.js';
import { toReceptionAppointmentDetail, toReceptionAppointmentSummary } from './reception-appointments.mappers.js';
import { queueRepository } from '../doctor-queue/queue.repository.js';
import { assertClinicPermission } from '../reception/reception.shared.js';
import { calculateAge } from '../../utils/age.js';
import { NotFoundError } from '../../utils/app-error.js';
import { bookingEngine } from '../booking/booking.engine.js';
import { bookingRepository } from '../booking/booking.repository.js';
import { toBookingConfirmationDto } from '../booking/booking.mappers.js';
import { queueEngine } from '../queue-engine/queue-engine.service.js';
import { doctorAppointmentsRepository } from '../doctor-appointments/doctor-appointments.repository.js';
import { doctorAppointmentsEngine } from '../doctor-appointments/doctor-appointments.service.js';
import { paymentEngine } from '../payments/payment.engine.js';

async function queuePositionFor(token: { id: string; status: TokenStatus; doctorSessionId: string; priority: TokenPriority; tokenNumber: number } | null | undefined) {
  if (!token) return null;
  if (token.status === 'WAITING') return (await queueRepository.countWaitingAhead(token.doctorSessionId, token)) + 1;
  if (token.status === 'CALLED') return 0;
  return null;
}

export const receptionAppointmentsService = {
  async list(userId: string, role: UserRole, query: ReceptionAppointmentListQuery): Promise<PaginatedResult<ReceptionAppointmentSummaryDto>> {
    await assertClinicPermission(userId, role, query.clinicId, CLINIC_PERMISSIONS.QUEUE_VIEW);
    const { items, total } = await receptionAppointmentsRepository.list(query.clinicId, query.tab, query.doctorId, query.page, query.limit);
    const mapped = await Promise.all(items.map(async (a) => toReceptionAppointmentSummary(a, await queuePositionFor(a.queueToken))));
    return {
      items: mapped,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  },

  async getById(userId: string, role: UserRole, clinicId: string, appointmentId: string): Promise<ReceptionAppointmentDetailDto> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.QUEUE_VIEW);
    const appointment = await receptionAppointmentsRepository.findByIdForClinic(appointmentId, clinicId);
    if (!appointment) {
      throw new NotFoundError('Appointment');
    }
    return toReceptionAppointmentDetail(appointment, await queuePositionFor(appointment.queueToken));
  },

  async searchPatients(userId: string, role: UserRole, clinicId: string, q: string, page: number, limit: number): Promise<PaginatedResult<PatientSearchResultDto>> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.QUEUE_VIEW);
    const { items, total } = await receptionAppointmentsRepository.searchPatients(clinicId, q, page, limit);
    const mapped: PatientSearchResultDto[] = items.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      age: calculateAge(p.dateOfBirth),
      gender: p.gender,
      phone: p.user.phone,
      profileImageUrl: p.profileImageUrl,
      lastAppointmentAt: p.appointments[0]?.scheduledAt.toISOString() ?? null,
    }));
    return { items: mapped, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },

  async quickView(userId: string, role: UserRole, clinicId: string, patientId: string): Promise<PatientQuickViewDto> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.QUEUE_VIEW);
    const patient = await receptionAppointmentsRepository.findPatientForClinic(patientId, clinicId);
    if (!patient) {
      throw new NotFoundError('Patient');
    }
    const todayAppointment = patient.appointments[0];

    return {
      id: patient.id,
      fullName: patient.fullName,
      age: calculateAge(patient.dateOfBirth),
      gender: patient.gender,
      phone: patient.user.phone,
      email: patient.user.email,
      profileImageUrl: patient.profileImageUrl,
      todayAppointment: todayAppointment
        ? toReceptionAppointmentSummary({ ...todayAppointment, patient }, await queuePositionFor(todayAppointment.queueToken))
        : null,
    };
  },

  /** Uses the same centralized booking engine as the patient self-booking flow — no parallel
   * slot logic for reception. Patient resolution reuses `queueEngine.resolveWalkInPatient`
   * (search-existing-or-create-new), the same function the walk-in flow already uses. */
  async create(userId: string, role: UserRole, input: ReceptionCreateAppointmentInput): Promise<BookingConfirmationDto> {
    await assertClinicPermission(userId, role, input.clinicId, CLINIC_PERMISSIONS.APPOINTMENT_MANAGE);

    // `resolveWalkInPatient` handles both branches: an existing patient by id (any patient, not
    // just one who already has a prior appointment at this clinic — booking their first
    // appointment here is exactly the common case) or provisioning a new patient record.
    const patient = await queueEngine.resolveWalkInPatient({
      existingPatientId: input.patientId,
      fullName: input.newPatient?.fullName,
      phone: input.newPatient?.phone,
      age: input.newPatient?.age,
      gender: input.newPatient?.gender,
    });

    const appointment = await bookingEngine.book({
      actorUserId: userId,
      patientId: patient.id,
      bookingSource: 'RECEPTION',
      holdId: input.holdId,
      doctorId: input.doctorId,
      clinicId: input.clinicId,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      consultationType: input.consultationType,
      appointmentType: input.appointmentType,
      reasonForVisit: input.reasonForVisit,
    });
    return toBookingConfirmationDto(appointment);
  },

  async reschedule(userId: string, role: UserRole, clinicId: string, appointmentId: string, input: RescheduleAppointmentInput) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.APPOINTMENT_MANAGE);
    const existing = await bookingRepository.findAppointmentByIdForActor(appointmentId);
    if (!existing || existing.clinicId !== clinicId) {
      throw new NotFoundError('Appointment');
    }
    const updated = await bookingEngine.reschedule(appointmentId, userId, 'RECEPTION', {
      newScheduledAt: new Date(input.newScheduledAt),
      holdId: input.holdId,
      reason: input.reason,
    });
    return toReceptionAppointmentDetail(
      { ...updated, queueToken: null },
      null,
    );
  },

  async cancel(userId: string, role: UserRole, clinicId: string, appointmentId: string, input: ReceptionCancelAppointmentInput) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.APPOINTMENT_MANAGE);
    const existing = await bookingRepository.findAppointmentByIdForActor(appointmentId);
    if (!existing || existing.clinicId !== clinicId) {
      throw new NotFoundError('Appointment');
    }
    const cancelled = await bookingEngine.cancelCore(existing, { reason: input.reason, actorUserId: userId, source: 'RECEPTION' });
    await paymentEngine.handleAppointmentCancelled(appointmentId, userId);
    return toReceptionAppointmentDetail(
      { ...cancelled, queueToken: null },
      null,
    );
  },

  /** Thin delegate to the existing, already-tested `doctorAppointmentsEngine.markNoShow` — zero
   * new no-show logic. */
  async markNoShow(userId: string, role: UserRole, clinicId: string, appointmentId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.APPOINTMENT_MANAGE);
    const basic = await bookingRepository.findAppointmentByIdForActor(appointmentId);
    if (!basic || basic.clinicId !== clinicId) {
      throw new NotFoundError('Appointment');
    }
    const appointment = await doctorAppointmentsRepository.findById(appointmentId, basic.doctorId);
    if (!appointment) {
      throw new NotFoundError('Appointment');
    }
    return doctorAppointmentsEngine.markNoShow(appointment, userId);
  },
};
