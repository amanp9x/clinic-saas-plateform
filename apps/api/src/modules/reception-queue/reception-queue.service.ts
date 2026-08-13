import { CLINIC_PERMISSIONS, type ClinicPermission, type UserRole } from '@clinic/shared';
import type { TokenPriority } from '@prisma/client';
import { queueRepository } from '../doctor-queue/queue.repository.js';
import { doctorQueueEngine } from '../doctor-queue/queue.service.js';
import { doctorAppointmentsEngine } from '../doctor-appointments/doctor-appointments.service.js';
import { doctorAppointmentsRepository } from '../doctor-appointments/doctor-appointments.repository.js';
import { consultationEngine } from '../doctor-consultation/consultation.service.js';
import { consultationRepository } from '../doctor-consultation/consultation.repository.js';
import { toQueueHistoryEvent, toReceptionQueueSnapshot } from './reception-queue.mappers.js';
import { assertClinicPermission, requireDoctorAtClinic } from '../reception/reception.shared.js';
import { prisma } from '../../config/database.js';
import { NotFoundError } from '../../utils/app-error.js';

async function hasPermission(userId: string, role: UserRole, clinicId: string, permission: ClinicPermission): Promise<boolean> {
  try {
    await assertClinicPermission(userId, role, clinicId, permission);
    return true;
  } catch {
    return false;
  }
}

async function buildSnapshot(userId: string, role: UserRole, doctorId: string, clinicId: string) {
  const [session, canUpdateDelay, canUpdatePriority] = await Promise.all([
    queueRepository.findSessionWithTokens(doctorId, clinicId),
    hasPermission(userId, role, clinicId, CLINIC_PERMISSIONS.QUEUE_DELAY_UPDATE),
    hasPermission(userId, role, clinicId, CLINIC_PERMISSIONS.QUEUE_PRIORITY_UPDATE),
  ]);
  return toReceptionQueueSnapshot(session, { canUpdateDelay, canUpdatePriority });
}

async function requireDoctor(doctorId: string) {
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) throw new NotFoundError('Doctor');
  return doctor;
}

async function requireClinicAppointment(appointmentId: string, doctorId: string, clinicId: string) {
  const appointment = await doctorAppointmentsRepository.findById(appointmentId, doctorId);
  if (!appointment || appointment.clinicId !== clinicId) {
    throw new NotFoundError('Appointment');
  }
  return appointment;
}

export const receptionQueueService = {
  async getSnapshot(userId: string, role: UserRole, clinicId: string, doctorId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.QUEUE_VIEW);
    await requireDoctorAtClinic(doctorId, clinicId);
    return buildSnapshot(userId, role, doctorId, clinicId);
  },

  async callNext(userId: string, role: UserRole, clinicId: string, doctorId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.QUEUE_MANAGE);
    await requireDoctorAtClinic(doctorId, clinicId);
    await doctorQueueEngine.callNext(doctorId, clinicId, userId);
    return buildSnapshot(userId, role, doctorId, clinicId);
  },

  async repeatCall(userId: string, role: UserRole, clinicId: string, doctorId: string, tokenId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.QUEUE_MANAGE);
    await requireDoctorAtClinic(doctorId, clinicId);
    await doctorQueueEngine.repeatCall(doctorId, clinicId, userId, tokenId);
    return buildSnapshot(userId, role, doctorId, clinicId);
  },

  async skip(userId: string, role: UserRole, clinicId: string, doctorId: string, tokenId: string, reason: string | undefined) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.QUEUE_MANAGE);
    await requireDoctorAtClinic(doctorId, clinicId);
    await doctorQueueEngine.skip(doctorId, clinicId, userId, tokenId, reason);
    return buildSnapshot(userId, role, doctorId, clinicId);
  },

  async pauseSession(userId: string, role: UserRole, clinicId: string, doctorId: string, reason: string | undefined) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.QUEUE_PAUSE);
    await requireDoctorAtClinic(doctorId, clinicId);
    await doctorQueueEngine.pauseSession(doctorId, clinicId, userId, reason);
    return buildSnapshot(userId, role, doctorId, clinicId);
  },

  async resumeSession(userId: string, role: UserRole, clinicId: string, doctorId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.QUEUE_RESUME);
    await requireDoctorAtClinic(doctorId, clinicId);
    await doctorQueueEngine.resumeSession(doctorId, clinicId, userId);
    return buildSnapshot(userId, role, doctorId, clinicId);
  },

  async updateDelay(userId: string, role: UserRole, clinicId: string, doctorId: string, delayMinutes: number | null, delayReason: string | null | undefined) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.QUEUE_DELAY_UPDATE);
    await requireDoctorAtClinic(doctorId, clinicId);
    await doctorQueueEngine.updateDelay(doctorId, clinicId, userId, delayMinutes, delayReason);
    return buildSnapshot(userId, role, doctorId, clinicId);
  },

  async updatePriority(userId: string, role: UserRole, clinicId: string, doctorId: string, tokenId: string, priority: TokenPriority) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.QUEUE_PRIORITY_UPDATE);
    await requireDoctorAtClinic(doctorId, clinicId);
    await doctorQueueEngine.updatePriority(doctorId, clinicId, userId, tokenId, priority);
    return buildSnapshot(userId, role, doctorId, clinicId);
  },

  async markInConsultation(userId: string, role: UserRole, clinicId: string, doctorId: string, appointmentId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.APPOINTMENT_MANAGE);
    const [doctor, appointment] = await Promise.all([requireDoctor(doctorId), requireClinicAppointment(appointmentId, doctorId, clinicId)]);
    await doctorAppointmentsEngine.start(doctor, appointment, userId);
    return buildSnapshot(userId, role, doctorId, clinicId);
  },

  async markCompleted(userId: string, role: UserRole, clinicId: string, doctorId: string, appointmentId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.APPOINTMENT_MANAGE);
    const [doctor, appointment] = await Promise.all([requireDoctor(doctorId), requireClinicAppointment(appointmentId, doctorId, clinicId)]);
    const consultation = await consultationRepository.findByAppointmentId(appointmentId);
    if (!consultation) {
      throw new NotFoundError('Consultation');
    }
    await consultationEngine.complete(doctor, appointment, consultation, userId);
    return buildSnapshot(userId, role, doctorId, clinicId);
  },

  async markNoShow(userId: string, role: UserRole, clinicId: string, doctorId: string, appointmentId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.APPOINTMENT_MANAGE);
    const appointment = await requireClinicAppointment(appointmentId, doctorId, clinicId);
    await doctorAppointmentsEngine.markNoShow(appointment, userId);
    return buildSnapshot(userId, role, doctorId, clinicId);
  },

  async history(userId: string, role: UserRole, clinicId: string, date: string | undefined, page: number, limit: number) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.QUEUE_VIEW);

    const where = {
      clinicId,
      ...(date ? { createdAt: { gte: new Date(`${date}T00:00:00.000Z`), lte: new Date(`${date}T23:59:59.999Z`) } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.auditLog.count({ where }),
    ]);

    const actorIds = [...new Set(rows.map((r) => r.actorUserId).filter((id): id is string => Boolean(id)))];
    const actors = actorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          include: { doctorProfile: true, patientProfile: true, clinicStaff: true },
        })
      : [];
    const nameById = new Map(
      actors.map((u) => [u.id, u.doctorProfile?.displayName ?? u.patientProfile?.fullName ?? u.email ?? u.phone ?? 'Unknown']),
    );

    return {
      items: rows.map((r) => toQueueHistoryEvent({ ...r, actorName: r.actorUserId ? (nameById.get(r.actorUserId) ?? null) : null })),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  },
};
