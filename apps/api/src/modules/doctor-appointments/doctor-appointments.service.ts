import { AppointmentStatus } from '@prisma/client';
import { SOCKET_EVENTS } from '@clinic/shared';
import type { DoctorAppointmentListQuery, PaginatedResult, DoctorAppointmentSummaryDto, DoctorAppointmentDetailDto } from '@clinic/shared';
import { doctorAppointmentsRepository } from './doctor-appointments.repository.js';
import { toDoctorAppointmentDetail } from './doctor-appointments.mappers.js';
import { toDoctorAppointmentSummary } from '../doctor/doctor.mappers.js';
import { resolveDoctorOrThrow } from '../doctor/doctor.shared.js';
import { queueRepository } from '../doctor-queue/queue.repository.js';
import { prisma } from '../../config/database.js';
import { ConflictError, NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom } from '../../sockets/emit.js';

const ACTIVE_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
]);

async function requireOwnedAppointment(doctorId: string, appointmentId: string) {
  const appointment = await doctorAppointmentsRepository.findById(appointmentId, doctorId);
  if (!appointment) {
    throw new NotFoundError('Appointment');
  }
  return appointment;
}

export const doctorAppointmentsService = {
  async list(userId: string, query: DoctorAppointmentListQuery): Promise<PaginatedResult<DoctorAppointmentSummaryDto>> {
    const doctor = await resolveDoctorOrThrow(userId);
    const { items, total } = await doctorAppointmentsRepository.list(
      doctor.id,
      query.tab,
      query.clinicId,
      query.page,
      query.limit,
    );
    return {
      items: items.map(toDoctorAppointmentSummary),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  },

  async getById(userId: string, appointmentId: string): Promise<DoctorAppointmentDetailDto> {
    const doctor = await resolveDoctorOrThrow(userId);
    const appointment = await requireOwnedAppointment(doctor.id, appointmentId);
    return toDoctorAppointmentDetail(appointment);
  },

  async start(userId: string, appointmentId: string): Promise<DoctorAppointmentDetailDto> {
    const doctor = await resolveDoctorOrThrow(userId);
    const appointment = await requireOwnedAppointment(doctor.id, appointmentId);
    if (!ACTIVE_STATUSES.has(appointment.status)) {
      throw new ConflictError(`An appointment with status ${appointment.status} cannot be started`);
    }

    const token = await queueRepository.findTokenByAppointmentId(appointmentId);

    const existingConsultation = await prisma.consultation.findUnique({ where: { appointmentId } });
    if (existingConsultation?.status === 'COMPLETED') {
      throw new ConflictError('This consultation has already been completed');
    }
    if (!existingConsultation) {
      await prisma.consultation.create({
        data: {
          appointmentId,
          doctorId: doctor.id,
          patientId: appointment.patientId,
          clinicId: appointment.clinicId,
          tokenId: token?.id,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
        },
      });
    } else if (existingConsultation.status === 'NOT_STARTED') {
      await prisma.consultation.update({
        where: { appointmentId },
        data: { status: 'IN_PROGRESS', startedAt: existingConsultation.startedAt ?? new Date() },
      });
    }

    const updated = await doctorAppointmentsRepository.updateStatus(appointmentId, {
      status: AppointmentStatus.IN_CONSULTATION,
    });
    if (token) {
      await queueRepository.updateToken(token.id, { status: 'IN_CONSULTATION', startedAt: new Date() });
    }

    recordAuditLog({ actorUserId: userId, action: 'doctor.consultation_started', entityType: 'Appointment', entityId: appointmentId });
    emitToClinicRoom(appointment.clinicId, SOCKET_EVENTS.CONSULTATION.STARTED, { appointmentId, clinicId: appointment.clinicId });
    emitToClinicRoom(appointment.clinicId, SOCKET_EVENTS.APPOINTMENT.UPDATED, { appointmentId, clinicId: appointment.clinicId, status: updated.status });
    return toDoctorAppointmentDetail(updated);
  },

  async markNoShow(userId: string, appointmentId: string): Promise<DoctorAppointmentDetailDto> {
    const doctor = await resolveDoctorOrThrow(userId);
    const appointment = await requireOwnedAppointment(doctor.id, appointmentId);
    if (!ACTIVE_STATUSES.has(appointment.status)) {
      throw new ConflictError(`An appointment with status ${appointment.status} cannot be marked no-show`);
    }

    const updated = await doctorAppointmentsRepository.updateStatus(appointmentId, {
      status: AppointmentStatus.NO_SHOW,
    });
    const token = await queueRepository.findTokenByAppointmentId(appointmentId);
    if (token) {
      await queueRepository.updateToken(token.id, { status: 'NO_SHOW' });
    }

    recordAuditLog({ actorUserId: userId, action: 'doctor.appointment_no_show', entityType: 'Appointment', entityId: appointmentId });
    emitToClinicRoom(appointment.clinicId, SOCKET_EVENTS.APPOINTMENT.UPDATED, { appointmentId, clinicId: appointment.clinicId, status: updated.status });
    emitToClinicRoom(appointment.clinicId, SOCKET_EVENTS.QUEUE.UPDATED, { clinicId: appointment.clinicId });
    return toDoctorAppointmentDetail(updated);
  },

  async skip(userId: string, appointmentId: string, reason: string | undefined): Promise<DoctorAppointmentDetailDto> {
    const doctor = await resolveDoctorOrThrow(userId);
    const appointment = await requireOwnedAppointment(doctor.id, appointmentId);
    const token = await queueRepository.findTokenByAppointmentId(appointmentId);
    if (!token) {
      throw new ConflictError('This appointment is not currently in a live queue');
    }
    if (token.status === 'COMPLETED' || token.status === 'CANCELLED') {
      throw new ConflictError(`A token with status ${token.status} cannot be skipped`);
    }

    await queueRepository.updateToken(token.id, { status: 'SKIPPED', skipReason: reason || null });
    if (token.doctorSession.currentTokenId === token.id) {
      await queueRepository.updateSession(token.doctorSessionId, { currentTokenId: null });
    }

    recordAuditLog({ actorUserId: userId, action: 'doctor.appointment_skipped', entityType: 'Appointment', entityId: appointmentId, metadata: { reason } });
    emitToClinicRoom(appointment.clinicId, SOCKET_EVENTS.PATIENT.SKIPPED, { clinicId: appointment.clinicId, appointmentId });
    emitToClinicRoom(appointment.clinicId, SOCKET_EVENTS.QUEUE.UPDATED, { clinicId: appointment.clinicId });
    return toDoctorAppointmentDetail(appointment);
  },
};
