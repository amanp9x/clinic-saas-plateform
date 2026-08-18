import { AppointmentStatus } from '@prisma/client';
import type {
  AppointmentListQuery,
  AvailabilityQuery,
  CancelAppointmentInput,
  CreateAppointmentInput,
  HoldSlotInput,
  PaginatedResult,
  QueueViewDto,
  RescheduleAppointmentInput,
} from '@clinic/shared';
import type { AppointmentDetailDto, AppointmentSummaryDto, AvailabilityResultDto, BookingConfirmationDto, SlotHoldDto } from '@clinic/shared';
import type { VisitSummaryDto } from '@clinic/shared';
import { appointmentsRepository } from './appointments.repository.js';
import { toAppointmentDetail, toAppointmentSummary, toVisitSummaryDto } from './appointments.mappers.js';
import { followUpRepository } from '../follow-up/follow-up.repository.js';
import { toVisitPrescriptionDto } from '../follow-up/follow-up.mappers.js';
import { patientRepository } from '../patient/patient.repository.js';
import { queueRepository } from '../doctor-queue/queue.repository.js';
import { calculateEta } from '../queue-engine/eta.service.js';
import { generateAvailableSlots } from '../booking/booking.availability.js';
import { toAvailabilityResultDto, toBookingConfirmationDto, toSlotHoldDto } from '../booking/booking.mappers.js';
import { bookingEngine } from '../booking/booking.engine.js';
import { bookingRepository } from '../booking/booking.repository.js';
import { paymentEngine } from '../payments/payment.engine.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../utils/app-error.js';

async function resolvePatientId(userId: string): Promise<string> {
  const patient = await patientRepository.findByUserId(userId);
  if (!patient) {
    throw new NotFoundError('Patient profile');
  }
  return patient.id;
}

export const appointmentsService = {
  async list(userId: string, query: AppointmentListQuery): Promise<PaginatedResult<AppointmentSummaryDto>> {
    const patientId = await resolvePatientId(userId);
    const { items, total } = await appointmentsRepository.list(patientId, query.tab, query.page, query.limit);
    return {
      items: items.map(toAppointmentSummary),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  },

  async getById(userId: string, appointmentId: string): Promise<AppointmentDetailDto> {
    const patientId = await resolvePatientId(userId);
    const appointment = await appointmentsRepository.findById(appointmentId, patientId);
    if (!appointment) {
      throw new NotFoundError('Appointment');
    }
    return toAppointmentDetail(appointment);
  },

  /** Phase 14 — joins this appointment's Consultation (vitals/diagnosis/notes/follow-up) and any
   * linked Prescription into one read, reusing existing data with no duplication. Only meaningful
   * once the visit is COMPLETED, mirroring `getQueueView`'s "not active" guard for the inverse case. */
  async getVisitSummary(userId: string, appointmentId: string): Promise<VisitSummaryDto> {
    const patient = await patientRepository.findByUserId(userId);
    if (!patient) {
      throw new NotFoundError('Patient profile');
    }
    const appointment = await appointmentsRepository.findById(appointmentId, patient.id);
    if (!appointment) {
      throw new NotFoundError('Appointment');
    }
    if (appointment.status !== AppointmentStatus.COMPLETED) {
      throw new ConflictError('This visit does not have a summary yet');
    }

    const [consultation, prescription] = await Promise.all([
      followUpRepository.findConsultationForAppointment(appointmentId),
      followUpRepository.findPrescriptionForAppointment(appointmentId),
    ]);

    return toVisitSummaryDto(appointment, consultation, prescription ? toVisitPrescriptionDto(prescription, patient.fullName) : null);
  },

  async cancel(userId: string, appointmentId: string, input: CancelAppointmentInput): Promise<AppointmentDetailDto> {
    const patientId = await resolvePatientId(userId);
    const appointment = await appointmentsRepository.findById(appointmentId, patientId);
    if (!appointment) {
      throw new NotFoundError('Appointment');
    }
    const cancelled = await bookingRepository.findAppointmentByIdForActor(appointmentId);
    if (!cancelled) {
      throw new NotFoundError('Appointment');
    }
    await bookingEngine.cancelCore(cancelled, { reason: input.reason, actorUserId: userId, source: 'PATIENT' });
    await paymentEngine.handleAppointmentCancelled(appointmentId, userId);
    const detail = await appointmentsRepository.findById(appointmentId, patientId);
    return toAppointmentDetail(detail!);
  },

  /**
   * Live queue snapshot for a specific appointment, backed by the Doctor Portal's
   * DoctorSession/QueueToken models (Phase 4). Falls back to an inactive snapshot when the
   * doctor hasn't pulled this appointment into a queue session yet. Real-time updates come from
   * the existing Socket.IO `/queue` namespace, which the Doctor Portal now actually emits to.
   */
  async getQueueView(userId: string, appointmentId: string): Promise<QueueViewDto> {
    const patientId = await resolvePatientId(userId);
    const appointment = await appointmentsRepository.findById(appointmentId, patientId);
    if (!appointment) {
      throw new NotFoundError('Appointment');
    }
    if (appointment.status === AppointmentStatus.CANCELLED || appointment.status === AppointmentStatus.NO_SHOW) {
      throw new ConflictError('This appointment is not active');
    }

    const base = {
      appointmentId: appointment.id,
      doctorName: appointment.doctor.displayName,
      clinicName: appointment.clinic.name,
      clinicId: appointment.clinicId,
      appointmentTime: appointment.scheduledAt.toISOString(),
      patientToken: appointment.tokenNumber,
      lastUpdatedAt: new Date().toISOString(),
    };

    const token = await queueRepository.findTokenByAppointmentId(appointmentId);
    if (!token) {
      return {
        ...base,
        isActive: false,
        currentToken: null,
        patientsAhead: null,
        estimatedWaitMinutes: null,
        delayMinutes: null,
        delayReason: null,
        doctorStatus: null,
        queueProgressPercent: null,
      };
    }

    const session = token.doctorSession;
    const [patientsAhead, totalTokens, completedCount, currentTokenRow] = await Promise.all([
      token.status === 'WAITING' ? queueRepository.countWaitingAhead(session.id, token) : Promise.resolve(0),
      queueRepository.countTotalTokens(session.id),
      queueRepository.countByStatus(session.id, 'COMPLETED'),
      session.currentTokenId ? queueRepository.findToken(session.currentTokenId) : Promise.resolve(null),
    ]);
    const effectivePatientsAhead = token.status === 'WAITING' ? patientsAhead : token.status === 'CALLED' ? 0 : null;

    return {
      ...base,
      patientToken: appointment.tokenNumber ?? String(token.tokenNumber),
      isActive: session.queueStatus === 'ACTIVE',
      currentToken: currentTokenRow ? String(currentTokenRow.tokenNumber) : null,
      patientsAhead: effectivePatientsAhead,
      estimatedWaitMinutes: calculateEta({
        patientsAhead: effectivePatientsAhead,
        avgConsultationMinutes: session.averageConsultationMinutes,
        delayMinutes: session.delayMinutes,
        queueStatus: session.queueStatus,
        doctorStatus: session.status,
      }),
      delayMinutes: session.delayMinutes,
      delayReason: session.delayReason,
      doctorStatus: session.status,
      queueProgressPercent: totalTokens > 0 ? Math.round((completedCount / totalTokens) * 100) : 0,
    };
  },

  async findUpcomingAndToday(userId: string) {
    const patientId = await resolvePatientId(userId);
    const [upcoming, today] = await Promise.all([
      appointmentsRepository.findUpcoming(patientId),
      appointmentsRepository.findToday(patientId),
    ]);
    return {
      upcoming: upcoming ? toAppointmentSummary(upcoming) : null,
      today: today ? toAppointmentSummary(today) : null,
    };
  },

  /** Public — no patient context needed; used by the doctor-discovery booking flow. */
  async getAvailability(query: AvailabilityQuery): Promise<AvailabilityResultDto> {
    const result = await generateAvailableSlots({
      doctorId: query.doctorId,
      clinicId: query.clinicId,
      date: query.date,
      consultationType: query.consultationType,
    });
    return toAvailabilityResultDto(result, query.date);
  },

  async holdSlot(userId: string, input: HoldSlotInput): Promise<SlotHoldDto> {
    const patientId = await resolvePatientId(userId);
    const hold = await bookingEngine.holdSlot({
      actorUserId: userId,
      patientId,
      bookingSource: 'PATIENT',
      doctorId: input.doctorId,
      clinicId: input.clinicId,
      scheduledAt: new Date(input.scheduledAt),
      consultationType: input.consultationType,
    });
    return toSlotHoldDto(hold);
  },

  async releaseHold(userId: string, holdId: string): Promise<void> {
    await bookingEngine.releaseHold(holdId, userId);
  },

  async create(userId: string, input: CreateAppointmentInput): Promise<BookingConfirmationDto> {
    const patientId = await resolvePatientId(userId);
    const appointment = await bookingEngine.book({
      actorUserId: userId,
      patientId,
      bookingSource: 'PATIENT',
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

  async reschedule(userId: string, appointmentId: string, input: RescheduleAppointmentInput): Promise<AppointmentDetailDto> {
    const patientId = await resolvePatientId(userId);
    const owned = await appointmentsRepository.findById(appointmentId, patientId);
    if (!owned) {
      throw new NotFoundError('Appointment');
    }
    if (owned.patientId !== patientId) {
      throw new ForbiddenError();
    }
    await bookingEngine.reschedule(appointmentId, userId, 'PATIENT', {
      newScheduledAt: new Date(input.newScheduledAt),
      holdId: input.holdId,
      reason: input.reason,
    });
    const detail = await appointmentsRepository.findById(appointmentId, patientId);
    return toAppointmentDetail(detail!);
  },
};
