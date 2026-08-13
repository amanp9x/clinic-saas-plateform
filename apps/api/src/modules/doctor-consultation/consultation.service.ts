import { MedicalRecordType, type Consultation } from '@prisma/client';
import { SOCKET_EVENTS } from '@clinic/shared';
import type { ConsultationDto, ConsultationUpsertInput } from '@clinic/shared';
import { consultationRepository } from './consultation.repository.js';
import { toConsultationDto } from './consultation.mappers.js';
import { resolveDoctorOrThrow } from '../doctor/doctor.shared.js';
import { doctorAppointmentsRepository } from '../doctor-appointments/doctor-appointments.repository.js';
import { queueRepository } from '../doctor-queue/queue.repository.js';
import { prisma } from '../../config/database.js';
import { ConflictError, NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom } from '../../sockets/emit.js';

async function requireOwnedConsultation(doctorId: string, appointmentId: string) {
  const appointment = await doctorAppointmentsRepository.findById(appointmentId, doctorId);
  if (!appointment) {
    throw new NotFoundError('Appointment');
  }
  const consultation = await consultationRepository.findByAppointmentId(appointmentId);
  if (!consultation) {
    throw new NotFoundError('Consultation');
  }
  return { appointment, consultation };
}

function toNullable(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value === '' ? null : value;
}

/**
 * Doctor-scoped consultation-completion core, parameterized by already-resolved doctor/
 * appointment/consultation records so the reception queue console's "mark completed" action
 * can trigger the exact same vitals/medical-record/average-duration cascade instead of
 * re-implementing it.
 */
export const consultationEngine = {
  async complete(
    doctor: { id: string; displayName: string },
    appointment: { id: string; clinicId: string },
    consultation: Consultation,
    actorUserId: string,
  ): Promise<ConsultationDto> {
    if (consultation.status !== 'IN_PROGRESS') {
      throw new ConflictError(`A consultation with status ${consultation.status} cannot be completed`);
    }

    const completedAt = new Date();
    const token = consultation.tokenId ? await queueRepository.findToken(consultation.tokenId) : null;

    const completedCountBefore = token ? await queueRepository.countByStatus(token.doctorSessionId, 'COMPLETED') : 0;

    const [updatedConsultation] = await prisma.$transaction([
      prisma.consultation.update({
        where: { appointmentId: appointment.id },
        data: { status: 'COMPLETED', completedAt },
      }),
      prisma.appointment.update({
        where: { id: appointment.id },
        data: { status: 'COMPLETED', completedAt },
      }),
      ...(token
        ? [
            prisma.queueToken.update({
              where: { id: token.id },
              data: { status: 'COMPLETED', completedAt },
            }),
          ]
        : []),
    ]);

    const hasVitals =
      consultation.heightCm != null ||
      consultation.weightKg != null ||
      consultation.temperatureC != null ||
      consultation.bloodPressureSystolic != null ||
      consultation.bloodPressureDiastolic != null ||
      consultation.pulseRate != null;

    if (hasVitals) {
      await prisma.vitalRecord.create({
        data: {
          patientId: consultation.patientId,
          recordedAt: completedAt,
          heightCm: consultation.heightCm,
          weightKg: consultation.weightKg,
          bloodPressureSystolic: consultation.bloodPressureSystolic,
          bloodPressureDiastolic: consultation.bloodPressureDiastolic,
          heartRateBpm: consultation.pulseRate,
          temperatureCelsius: consultation.temperatureC,
        },
      });
    }

    await prisma.medicalRecord.create({
      data: {
        patientId: consultation.patientId,
        doctorId: doctor.id,
        recordType: MedicalRecordType.CONSULTATION_NOTE,
        title: consultation.diagnosis ? `Consultation — ${consultation.diagnosis}` : 'Consultation note',
        description: consultation.doctorNotes ?? consultation.treatmentPlan ?? null,
        recordDate: completedAt,
        doctorName: doctor.displayName,
      },
    });

    if (token) {
      const startedAt = consultation.startedAt ?? completedAt;
      const durationMinutes = Math.max(1, Math.round((completedAt.getTime() - startedAt.getTime()) / 60000));
      const session = await prisma.doctorSession.findUnique({ where: { id: token.doctorSessionId } });
      const newAverage = session?.averageConsultationMinutes
        ? Math.round((session.averageConsultationMinutes * completedCountBefore + durationMinutes) / (completedCountBefore + 1))
        : durationMinutes;
      await prisma.doctorSession.update({
        where: { id: token.doctorSessionId },
        data: {
          averageConsultationMinutes: newAverage,
          currentTokenId: session?.currentTokenId === token.id ? null : session?.currentTokenId,
        },
      });
    }

    recordAuditLog({ actorUserId, action: 'queue.consultation_completed', entityType: 'Consultation', entityId: updatedConsultation.id, clinicId: appointment.clinicId, metadata: { doctorId: doctor.id } });
    emitToClinicRoom(appointment.clinicId, SOCKET_EVENTS.CONSULTATION.COMPLETED, { appointmentId: appointment.id, clinicId: appointment.clinicId });
    emitToClinicRoom(appointment.clinicId, SOCKET_EVENTS.PATIENT.COMPLETED, { appointmentId: appointment.id, clinicId: appointment.clinicId });
    emitToClinicRoom(appointment.clinicId, SOCKET_EVENTS.APPOINTMENT.UPDATED, { appointmentId: appointment.id, clinicId: appointment.clinicId, status: 'COMPLETED' });
    emitToClinicRoom(appointment.clinicId, SOCKET_EVENTS.QUEUE.UPDATED, { clinicId: appointment.clinicId });

    return toConsultationDto(updatedConsultation);
  },
};

export const consultationService = {
  async get(userId: string, appointmentId: string): Promise<ConsultationDto> {
    const doctor = await resolveDoctorOrThrow(userId);
    const { consultation } = await requireOwnedConsultation(doctor.id, appointmentId);
    return toConsultationDto(consultation);
  },

  async upsert(userId: string, appointmentId: string, input: ConsultationUpsertInput): Promise<ConsultationDto> {
    const doctor = await resolveDoctorOrThrow(userId);
    const { consultation } = await requireOwnedConsultation(doctor.id, appointmentId);
    if (consultation.status === 'COMPLETED') {
      throw new ConflictError('This consultation has already been completed and cannot be edited');
    }

    const updated = await consultationRepository.update(appointmentId, {
      chiefComplaint: toNullable(input.chiefComplaint),
      symptoms: input.symptoms,
      heightCm: input.vitals?.heightCm,
      weightKg: input.vitals?.weightKg,
      temperatureC: input.vitals?.temperatureC,
      bloodPressureSystolic: input.vitals?.bloodPressureSystolic,
      bloodPressureDiastolic: input.vitals?.bloodPressureDiastolic,
      pulseRate: input.vitals?.pulseRate,
      respiratoryRate: input.vitals?.respiratoryRate,
      spo2: input.vitals?.spo2,
      diagnosis: toNullable(input.diagnosis),
      doctorNotes: toNullable(input.doctorNotes),
      treatmentPlan: toNullable(input.treatmentPlan),
      followUpDate: input.followUpDate === undefined ? undefined : input.followUpDate ? new Date(input.followUpDate) : null,
    });

    recordAuditLog({ actorUserId: userId, action: 'doctor.consultation_updated', entityType: 'Consultation', entityId: updated.id });
    return toConsultationDto(updated);
  },

  async complete(userId: string, appointmentId: string): Promise<ConsultationDto> {
    const doctor = await resolveDoctorOrThrow(userId);
    const { appointment, consultation } = await requireOwnedConsultation(doctor.id, appointmentId);
    return consultationEngine.complete(doctor, appointment, consultation, userId);
  },
};

export { requireOwnedConsultation };
