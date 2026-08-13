import { AppointmentStatus, NotificationType } from '@prisma/client';
import type { AppointmentListQuery, CancelAppointmentInput, PaginatedResult, QueueViewDto } from '@clinic/shared';
import type { AppointmentDetailDto, AppointmentSummaryDto } from '@clinic/shared';
import { appointmentsRepository } from './appointments.repository.js';
import { toAppointmentDetail, toAppointmentSummary } from './appointments.mappers.js';
import { patientRepository } from '../patient/patient.repository.js';
import { notifyUser } from '../notifications/notifications.service.js';
import { queueRepository } from '../doctor-queue/queue.repository.js';
import { calculateEta } from '../queue-engine/eta.service.js';
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
};
