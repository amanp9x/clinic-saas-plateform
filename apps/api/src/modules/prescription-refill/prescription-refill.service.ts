import { NotificationType } from '@prisma/client';
import type { PaginatedResult, RefillRequestCreateInput, RefillRequestDto, RefillRequestListQuery, RefillRequestRespondInput } from '@clinic/shared';
import { prescriptionRefillRepository } from './prescription-refill.repository.js';
import { toRefillRequestDto } from './prescription-refill.mappers.js';
import { prescriptionRepository } from '../doctor-prescription/prescription.repository.js';
import { patientRepository } from '../patient/patient.repository.js';
import { resolveDoctorOrThrow } from '../doctor/doctor.shared.js';
import { notifyUser } from '../notifications/notification-dispatch.service.js';
import { ConflictError, NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';

async function resolvePatientOrThrow(userId: string) {
  const patient = await patientRepository.findByUserId(userId);
  if (!patient) {
    throw new NotFoundError('Patient profile');
  }
  return patient;
}

function toNullable(value: string | undefined): string | null {
  if (value === undefined || value === '') return null;
  return value;
}

export const prescriptionRefillService = {
  async create(userId: string, prescriptionId: string, input: RefillRequestCreateInput): Promise<RefillRequestDto> {
    const patient = await resolvePatientOrThrow(userId);

    const prescription = await prescriptionRefillRepository.findPrescriptionForPatient(prescriptionId, patient.id);
    if (!prescription) {
      throw new NotFoundError('Prescription');
    }
    if (prescription.status !== 'FINALIZED') {
      throw new ConflictError('Only finalized prescriptions can be refilled');
    }

    const existingPending = await prescriptionRefillRepository.findPendingForPrescription(prescriptionId);
    if (existingPending) {
      throw new ConflictError('A refill request for this prescription is already pending');
    }

    const created = await prescriptionRefillRepository.create({
      prescriptionId,
      patientId: patient.id,
      doctorId: prescription.doctorId,
      patientNote: toNullable(input.patientNote),
    });

    recordAuditLog({
      actorUserId: userId,
      action: 'patient.refill_requested',
      entityType: 'PrescriptionRefillRequest',
      entityId: created.id,
      metadata: { prescriptionId },
    });

    return toRefillRequestDto(created);
  },

  async listForPatient(userId: string, query: RefillRequestListQuery): Promise<PaginatedResult<RefillRequestDto>> {
    const patient = await resolvePatientOrThrow(userId);
    const { items, total } = await prescriptionRefillRepository.listForPatient(patient.id, { status: query.status }, query.page, query.limit);
    return {
      items: items.map(toRefillRequestDto),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  },

  async listForDoctor(userId: string, query: RefillRequestListQuery): Promise<PaginatedResult<RefillRequestDto>> {
    const doctor = await resolveDoctorOrThrow(userId);
    const { items, total } = await prescriptionRefillRepository.listForDoctor(doctor.id, { status: query.status }, query.page, query.limit);
    return {
      items: items.map(toRefillRequestDto),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  },

  async respond(userId: string, id: string, input: RefillRequestRespondInput): Promise<RefillRequestDto> {
    const doctor = await resolveDoctorOrThrow(userId);
    const existing = await prescriptionRefillRepository.findByIdForDoctor(id, doctor.id);
    if (!existing) {
      throw new NotFoundError('Refill request');
    }
    if (existing.status !== 'PENDING') {
      throw new ConflictError('This request has already been responded to');
    }

    const doctorNote = toNullable(input.doctorNote);
    const claimedCount = await prescriptionRefillRepository.claimForResponse(id, doctor.id, {
      status: input.status,
      doctorNote,
      respondedByUserId: userId,
    });
    if (claimedCount !== 1) {
      // Lost the race to a concurrent response on the same request.
      throw new ConflictError('This request has already been responded to');
    }

    if (input.status === 'APPROVED') {
      const items = existing.prescription.items.map((item, index) => ({
        sortOrder: index,
        medicineName: item.medicineName,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        route: item.route,
        instructions: item.instructions,
        beforeAfterFood: item.beforeAfterFood,
        quantity: item.quantity,
      }));

      const issued = await prescriptionRepository.create(
        doctor.id,
        {
          patientId: existing.patientId,
          appointmentId: undefined,
          consultationId: undefined,
          diagnosis: existing.prescription.diagnosis,
          advice: existing.prescription.advice,
          followUpDate: null,
          labTestRecommendation: existing.prescription.labTestRecommendation,
          notes: `Refill of prescription issued ${existing.prescription.issuedAt.toISOString().slice(0, 10)}`,
        },
        items,
      );

      await prescriptionRefillRepository.setIssuedPrescription(id, issued.id);

      recordAuditLog({
        actorUserId: userId,
        action: 'doctor.refill_request_approved',
        entityType: 'PrescriptionRefillRequest',
        entityId: id,
        metadata: { issuedPrescriptionId: issued.id },
      });
    } else {
      recordAuditLog({
        actorUserId: userId,
        action: 'doctor.refill_request_declined',
        entityType: 'PrescriptionRefillRequest',
        entityId: id,
        metadata: { doctorNote },
      });

      await notifyUser({
        userId: existing.patient.userId,
        type: NotificationType.PRESCRIPTION_REFILL_DECLINED,
        title: 'Refill request declined',
        message: `${doctor.displayName} declined your refill request.${doctorNote ? ` Reason: ${doctorNote}` : ''}`,
        relatedEntityType: 'PrescriptionRefillRequest',
        relatedEntityId: id,
        actionUrl: '/medical-records/prescriptions',
        notificationKey: `refill-request:${id}:declined`,
      });
    }

    const final = await prescriptionRefillRepository.findById(id);
    return toRefillRequestDto(final!);
  },
};
