import fs from 'node:fs/promises';
import path from 'node:path';
import { NotificationType } from '@prisma/client';
import type {
  DoctorPrescriptionDto,
  DoctorSignatureDto,
  PaginatedResult,
  PrescriptionCreateInput,
  PrescriptionItemInput,
  PrescriptionListQuery,
  PrescriptionUpdateInput,
  SignatureUpsertInput,
} from '@clinic/shared';
import { prescriptionRepository } from './prescription.repository.js';
import { toDoctorPrescriptionDto } from './prescription.mappers.js';
import { generatePrescriptionPdf } from './prescription-pdf.service.js';
import { resolveDoctorOrThrow } from '../doctor/doctor.shared.js';
import { doctorAppointmentsRepository } from '../doctor-appointments/doctor-appointments.repository.js';
import { doctorPatientsRepository } from '../doctor-patients/doctor-patients.repository.js';
import { consultationRepository } from '../doctor-consultation/consultation.repository.js';
import { notifyUser } from '../notifications/notifications.service.js';
import { prisma } from '../../config/database.js';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { sha256Hex } from '../../utils/hash.js';
import { saveGeneratedFile, saveUploadedFile, deleteUploadedFile, relativePathFromUrl, UPLOADS_DIR } from '../../services/storage.service.js';

function toNullable(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value === '' ? null : value;
}

function normalizeItems(items: PrescriptionItemInput[]) {
  return items.map((item, index) => ({
    sortOrder: index,
    medicineName: item.medicineName.trim(),
    dosage: item.dosage.trim(),
    frequency: item.frequency.trim(),
    duration: item.duration.trim(),
    route: toNullable(item.route) ?? null,
    instructions: toNullable(item.instructions) ?? null,
    beforeAfterFood: item.beforeAfterFood ?? null,
    quantity: toNullable(item.quantity) ?? null,
  }));
}

async function requireOwnedPrescription(doctorId: string, id: string) {
  const prescription = await prescriptionRepository.findById(id, doctorId);
  if (!prescription) {
    throw new NotFoundError('Prescription');
  }
  return prescription;
}

export const prescriptionService = {
  async list(userId: string, query: PrescriptionListQuery): Promise<PaginatedResult<DoctorPrescriptionDto>> {
    const doctor = await resolveDoctorOrThrow(userId);
    const { items, total } = await prescriptionRepository.list(
      doctor.id,
      {
        patientId: query.patientId,
        appointmentId: query.appointmentId,
        status: query.status,
      },
      query.page,
      query.limit,
    );
    return {
      items: items.map(toDoctorPrescriptionDto),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  },

  async getById(userId: string, id: string): Promise<DoctorPrescriptionDto> {
    const doctor = await resolveDoctorOrThrow(userId);
    const prescription = await requireOwnedPrescription(doctor.id, id);
    return toDoctorPrescriptionDto(prescription);
  },

  async create(userId: string, input: PrescriptionCreateInput): Promise<DoctorPrescriptionDto> {
    const doctor = await resolveDoctorOrThrow(userId);

    const authorized = await doctorPatientsRepository.hasCareRelationship(doctor.id, input.patientId);
    if (!authorized) {
      throw new NotFoundError('Patient');
    }

    let consultationId: string | undefined;
    if (input.appointmentId) {
      const appointment = await doctorAppointmentsRepository.findById(input.appointmentId, doctor.id);
      if (!appointment) {
        throw new NotFoundError('Appointment');
      }
      const consultation = await consultationRepository.findByAppointmentId(input.appointmentId);
      consultationId = consultation?.id;
    }

    const created = await prescriptionRepository.create(
      doctor.id,
      {
        patientId: input.patientId,
        appointmentId: input.appointmentId,
        consultationId,
        diagnosis: toNullable(input.diagnosis) ?? null,
        advice: toNullable(input.advice) ?? null,
        followUpDate: input.followUpDate ? new Date(input.followUpDate) : null,
        labTestRecommendation: input.labTestRecommendation ?? [],
        notes: toNullable(input.notes) ?? null,
      },
      normalizeItems(input.items),
    );

    recordAuditLog({ actorUserId: userId, action: 'doctor.prescription_created', entityType: 'Prescription', entityId: created.id });
    return toDoctorPrescriptionDto(created);
  },

  async update(userId: string, id: string, input: PrescriptionUpdateInput): Promise<DoctorPrescriptionDto> {
    const doctor = await resolveDoctorOrThrow(userId);
    const existing = await requireOwnedPrescription(doctor.id, id);
    if (existing.status !== 'DRAFT') {
      throw new ConflictError('Only draft prescriptions can be edited');
    }

    const updated = await prescriptionRepository.update(
      id,
      {
        diagnosis: toNullable(input.diagnosis) ?? null,
        advice: toNullable(input.advice) ?? null,
        followUpDate: input.followUpDate ? new Date(input.followUpDate) : null,
        labTestRecommendation: input.labTestRecommendation ?? [],
        notes: toNullable(input.notes) ?? null,
      },
      normalizeItems(input.items),
    );

    recordAuditLog({ actorUserId: userId, action: 'doctor.prescription_updated', entityType: 'Prescription', entityId: id });
    return toDoctorPrescriptionDto(updated);
  },

  async finalize(userId: string, id: string): Promise<DoctorPrescriptionDto> {
    const doctor = await resolveDoctorOrThrow(userId);
    const existing = await requireOwnedPrescription(doctor.id, id);
    if (existing.status !== 'DRAFT') {
      throw new ConflictError('This prescription has already been finalized');
    }
    if (existing.items.length === 0) {
      throw new ValidationError('Add at least one medicine before finalizing');
    }

    const signature = await prisma.doctorSignature.findUnique({ where: { doctorId: doctor.id } });
    const patientAge = existing.patient.dateOfBirth
      ? Math.floor((Date.now() - existing.patient.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    const pdfBuffer = await generatePrescriptionPdf({
      doctorName: doctor.displayName,
      doctorQualifications: doctor.qualifications,
      clinicName: existing.appointment?.clinic.name ?? null,
      clinicAddress: existing.appointment?.clinic.addressLine1 ?? null,
      patientName: existing.patient.fullName,
      patientAge,
      patientGender: existing.patient.gender,
      issuedAt: existing.issuedAt,
      diagnosis: existing.diagnosis,
      advice: existing.advice,
      followUpDate: existing.followUpDate,
      labTestRecommendation: existing.labTestRecommendation,
      items: existing.items,
      signatureText: signature?.signatureText ?? doctor.displayName,
    });

    const { url } = await saveGeneratedFile({ buffer: pdfBuffer, extension: '.pdf', subdirectory: 'prescriptions' });

    const canonicalContent = JSON.stringify({
      id: existing.id,
      doctorId: existing.doctorId,
      patientId: existing.patientId,
      diagnosis: existing.diagnosis,
      items: existing.items.map((i) => ({ n: i.medicineName, d: i.dosage, f: i.frequency, dur: i.duration })),
    });
    const signatureHash = sha256Hex(canonicalContent);
    const signedAt = new Date();

    const updated = await prescriptionRepository.update(id, {
      status: 'FINALIZED',
      signedAt,
      signatureImageUrl: signature?.signatureImageUrl ?? null,
      signatureHash,
      pdfUrl: url,
    });

    recordAuditLog({ actorUserId: userId, action: 'doctor.prescription_finalized', entityType: 'Prescription', entityId: id });

    await notifyUser({
      userId: existing.patient.userId,
      type: NotificationType.PRESCRIPTION_READY,
      title: 'New prescription available',
      message: `${doctor.displayName} has issued a new prescription for you.`,
      relatedEntityType: 'Prescription',
      relatedEntityId: id,
    });

    return toDoctorPrescriptionDto(updated);
  },

  async getPdfFile(userId: string, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const doctor = await resolveDoctorOrThrow(userId);
    const prescription = await requireOwnedPrescription(doctor.id, id);
    if (!prescription.pdfUrl) {
      throw new ConflictError('This prescription has not been finalized yet');
    }
    const relativePath = relativePathFromUrl(prescription.pdfUrl);
    if (!relativePath) {
      throw new NotFoundError('Prescription PDF');
    }
    const buffer = await fs.readFile(path.join(UPLOADS_DIR, relativePath));
    return { buffer, filename: `prescription-${prescription.id}.pdf` };
  },

  async getSignature(userId: string): Promise<DoctorSignatureDto> {
    const doctor = await resolveDoctorOrThrow(userId);
    const signature = await prisma.doctorSignature.findUnique({ where: { doctorId: doctor.id } });
    return {
      signatureImageUrl: signature?.signatureImageUrl ?? null,
      signatureText: signature?.signatureText ?? null,
      updatedAt: signature?.updatedAt ? signature.updatedAt.toISOString() : null,
    };
  },

  async updateSignatureText(userId: string, input: SignatureUpsertInput): Promise<DoctorSignatureDto> {
    const doctor = await resolveDoctorOrThrow(userId);
    const signature = await prisma.doctorSignature.upsert({
      where: { doctorId: doctor.id },
      update: { signatureText: toNullable(input.signatureText) ?? null },
      create: { doctorId: doctor.id, signatureText: toNullable(input.signatureText) ?? null },
    });
    recordAuditLog({ actorUserId: userId, action: 'doctor.signature_updated', entityType: 'DoctorSignature', entityId: signature.id });
    return {
      signatureImageUrl: signature.signatureImageUrl,
      signatureText: signature.signatureText,
      updatedAt: signature.updatedAt.toISOString(),
    };
  },

  async uploadSignatureImage(userId: string, file: { buffer: Buffer; originalname: string }): Promise<DoctorSignatureDto> {
    const doctor = await resolveDoctorOrThrow(userId);
    const existing = await prisma.doctorSignature.findUnique({ where: { doctorId: doctor.id } });
    const { url } = await saveUploadedFile({ buffer: file.buffer, originalName: file.originalname, subdirectory: 'signatures' });

    const signature = await prisma.doctorSignature.upsert({
      where: { doctorId: doctor.id },
      update: { signatureImageUrl: url },
      create: { doctorId: doctor.id, signatureImageUrl: url },
    });

    if (existing?.signatureImageUrl) {
      const relative = relativePathFromUrl(existing.signatureImageUrl);
      if (relative) await deleteUploadedFile(relative).catch(() => undefined);
    }

    recordAuditLog({ actorUserId: userId, action: 'doctor.signature_image_updated', entityType: 'DoctorSignature', entityId: signature.id });
    return {
      signatureImageUrl: signature.signatureImageUrl,
      signatureText: signature.signatureText,
      updatedAt: signature.updatedAt.toISOString(),
    };
  },

  async removeSignatureImage(userId: string): Promise<void> {
    const doctor = await resolveDoctorOrThrow(userId);
    const existing = await prisma.doctorSignature.findUnique({ where: { doctorId: doctor.id } });
    if (!existing?.signatureImageUrl) {
      return;
    }
    const relative = relativePathFromUrl(existing.signatureImageUrl);
    if (relative) await deleteUploadedFile(relative).catch(() => undefined);
    await prisma.doctorSignature.update({ where: { doctorId: doctor.id }, data: { signatureImageUrl: null } });
  },
};

