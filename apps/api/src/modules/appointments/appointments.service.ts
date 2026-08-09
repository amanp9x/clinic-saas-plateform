import { AppointmentStatus, NotificationType } from '@prisma/client';
import type { AppointmentListQuery, CancelAppointmentInput, PaginatedResult, QueueViewDto } from '@clinic/shared';
import type { AppointmentDetailDto, AppointmentSummaryDto } from '@clinic/shared';
import { appointmentsRepository } from './appointments.repository.js';
import { toAppointmentDetail, toAppointmentSummary } from './appointments.mappers.js';
import { patientRepository } from '../patient/patient.repository.js';
import { notifyUser } from '../notifications/notifications.service.js';
import { ConflictError, NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';

const CANCELLABLE_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
]);

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

  async cancel(userId: string, appointmentId: string, input: CancelAppointmentInput): Promise<AppointmentDetailDto> {
    const patientId = await resolvePatientId(userId);
    const appointment = await appointmentsRepository.findById(appointmentId, patientId);
    if (!appointment) {
      throw new NotFoundError('Appointment');
    }
    if (!CANCELLABLE_STATUSES.has(appointment.status)) {
      throw new ConflictError(`An appointment with status ${appointment.status} cannot be cancelled`);
    }

    const cancelled = await appointmentsRepository.cancel(appointmentId, input.reason);

    await notifyUser({
      userId,
      type: NotificationType.APPOINTMENT_UPDATE,
      title: 'Appointment cancelled',
      message: `Your appointment with ${appointment.doctor.displayName} on ${appointment.scheduledAt.toLocaleDateString(
        'en-IN',
      )} has been cancelled.`,
      relatedEntityType: 'Appointment',
      relatedEntityId: appointmentId,
    });

    recordAuditLog({
      actorUserId: userId,
      action: 'appointment.cancelled',
      entityType: 'Appointment',
      entityId: appointmentId,
      metadata: { reason: input.reason },
    });

    return toAppointmentDetail(cancelled);
  },

  /**
   * Initial queue snapshot for a specific appointment. Always `isActive: false` — no live-queue
   * module exists yet (it needs a receptionist dashboard to produce real state, which is out of
   * scope for the Patient Portal). Once that module ships, this stays the same contract; only
   * the values change. Real-time updates come from the existing Socket.IO `/queue` namespace.
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

    return {
      appointmentId: appointment.id,
      doctorName: appointment.doctor.displayName,
      clinicName: appointment.clinic.name,
      clinicId: appointment.clinicId,
      appointmentTime: appointment.scheduledAt.toISOString(),
      patientToken: appointment.tokenNumber,
      isActive: false,
      currentToken: null,
      patientsAhead: null,
      estimatedWaitMinutes: null,
      delayMinutes: null,
      delayReason: null,
      doctorStatus: null,
      queueProgressPercent: null,
      lastUpdatedAt: new Date().toISOString(),
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
};
