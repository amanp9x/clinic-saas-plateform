import { CLINIC_PERMISSIONS, SOCKET_EVENTS, type UserRole } from '@clinic/shared';
import type {
  ClinicDocumentType,
  ClinicOperatingStatus,
  ClinicProfileUpdateInput,
  ClinicSettingsUpdateInput,
  ClinicStatusUpdateInput,
  ClinicVerificationSubmitInput,
} from '@clinic/shared';
import { AppointmentStatus } from '@prisma/client';
import { clinicRepository } from './clinic.repository.js';
import { DEFAULT_CLINIC_SETTINGS_DTO, toClinicDocumentDto, toClinicProfileDto, toClinicSettingsDto } from './clinic.mappers.js';
import { assertClinicPermission } from '../reception/reception.shared.js';
import { prisma } from '../../config/database.js';
import { startOfDay, endOfDay } from '../../utils/date.js';
import { NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom } from '../../sockets/emit.js';
import { savePrivateFile, deletePrivateFile, privateFilePath } from '../../services/storage.service.js';

async function requireClinic(clinicId: string) {
  const clinic = await clinicRepository.findById(clinicId);
  if (!clinic) throw new NotFoundError('Clinic');
  return clinic;
}

export const clinicService = {
  async getProfile(userId: string, role: UserRole, clinicId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.CLINIC_VIEW);
    const clinic = await requireClinic(clinicId);
    return toClinicProfileDto(clinic);
  },

  async updateProfile(userId: string, role: UserRole, clinicId: string, input: ClinicProfileUpdateInput) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.CLINIC_UPDATE);
    await requireClinic(clinicId);

    const updated = await clinicRepository.update(clinicId, input);

    recordAuditLog({ actorUserId: userId, action: 'clinic.profile_updated', entityType: 'Clinic', entityId: clinicId, clinicId, metadata: { fields: Object.keys(input) } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.CLINIC.UPDATED, { clinicId });
    return toClinicProfileDto(updated);
  },

  async submitVerification(userId: string, role: UserRole, clinicId: string, input: ClinicVerificationSubmitInput) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.CLINIC_UPDATE);
    await requireClinic(clinicId);

    const updated = await clinicRepository.update(clinicId, {
      verificationStatus: 'SUBMITTED',
      verificationSubmittedAt: new Date(),
      verificationNotes: input.notes ?? null,
    });

    recordAuditLog({ actorUserId: userId, action: 'clinic.verification_submitted', entityType: 'Clinic', entityId: clinicId, clinicId });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.CLINIC.UPDATED, { clinicId });
    return toClinicProfileDto(updated);
  },

  async updateStatus(userId: string, role: UserRole, clinicId: string, input: ClinicStatusUpdateInput) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.CLINIC_UPDATE);
    const clinic = await requireClinic(clinicId);

    const updated = await clinicRepository.update(clinicId, {
      status: input.status as ClinicOperatingStatus,
      statusReason: input.status === 'TEMPORARILY_CLOSED' ? (input.reason ?? null) : null,
      statusUpdatedAt: new Date(),
    });

    recordAuditLog({
      actorUserId: userId,
      action: 'clinic.status_updated',
      entityType: 'Clinic',
      entityId: clinicId,
      clinicId,
      metadata: { previousState: { status: clinic.status }, newState: { status: input.status, reason: input.reason } },
    });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.CLINIC.STATUS_UPDATED, { clinicId, status: input.status, reason: input.reason ?? null });
    return toClinicProfileDto(updated);
  },

  async getSettings(userId: string, role: UserRole, clinicId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.CLINIC_VIEW);
    const settings = await clinicRepository.findSettings(clinicId);
    return settings ? toClinicSettingsDto(settings) : { clinicId, ...DEFAULT_CLINIC_SETTINGS_DTO };
  },

  async updateSettings(userId: string, role: UserRole, clinicId: string, input: ClinicSettingsUpdateInput) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.CLINIC_UPDATE);
    await requireClinic(clinicId);

    const updated = await clinicRepository.upsertSettings(clinicId, input);

    recordAuditLog({ actorUserId: userId, action: 'clinic.settings_updated', entityType: 'ClinicSettings', entityId: updated.id, clinicId, metadata: { fields: Object.keys(input) } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.CLINIC.QUEUE_SETTINGS_UPDATED, { clinicId });
    return toClinicSettingsDto(updated);
  },

  async uploadDocument(userId: string, role: UserRole, clinicId: string, type: ClinicDocumentType, expiryDate: string | undefined, file: Express.Multer.File) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.CLINIC_DOCUMENTS_MANAGE);
    await requireClinic(clinicId);

    const { relativePath } = await savePrivateFile({
      buffer: file.buffer,
      originalName: file.originalname,
      subdirectory: `clinic-documents/${clinicId}`,
    });

    const doc = await clinicRepository.createDocument({
      clinicId,
      type,
      fileName: file.originalname,
      relativePath,
      fileSizeBytes: file.size,
      mimeType: file.mimetype,
      uploadedByUserId: userId,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
    });

    recordAuditLog({ actorUserId: userId, action: 'clinic.document_uploaded', entityType: 'ClinicDocument', entityId: doc.id, clinicId, metadata: { type, fileName: file.originalname, expiryDate: expiryDate || null } });
    return toClinicDocumentDto(doc);
  },

  async listDocuments(userId: string, role: UserRole, clinicId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.CLINIC_DOCUMENTS_MANAGE);
    const docs = await clinicRepository.listDocuments(clinicId);
    return docs.map(toClinicDocumentDto);
  },

  async resolveDocumentForDownload(userId: string, role: UserRole, clinicId: string, documentId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.CLINIC_DOCUMENTS_MANAGE);
    const doc = await clinicRepository.findDocument(documentId, clinicId);
    if (!doc) throw new NotFoundError('Document');
    return { doc, absolutePath: privateFilePath(doc.relativePath) };
  },

  async deleteDocument(userId: string, role: UserRole, clinicId: string, documentId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.CLINIC_DOCUMENTS_MANAGE);
    const doc = await clinicRepository.findDocument(documentId, clinicId);
    if (!doc) throw new NotFoundError('Document');

    await deletePrivateFile(doc.relativePath);
    await clinicRepository.deleteDocument(documentId);

    recordAuditLog({ actorUserId: userId, action: 'clinic.document_deleted', entityType: 'ClinicDocument', entityId: documentId, clinicId, metadata: { fileName: doc.fileName } });
  },

  /** Phase 17 — Compliance & Renewal. Lets a clinic set/correct/clear a document's expiry date
   * without needing a full re-upload — useful both to backfill dates on documents uploaded before
   * this phase existed, and to update a date after physically renewing a license offline. */
  async updateDocumentExpiry(userId: string, role: UserRole, clinicId: string, documentId: string, expiryDate: string | null) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.CLINIC_DOCUMENTS_MANAGE);
    const doc = await clinicRepository.findDocument(documentId, clinicId);
    if (!doc) throw new NotFoundError('Document');

    const updated = await clinicRepository.updateDocumentExpiry(documentId, expiryDate ? new Date(expiryDate) : null);

    recordAuditLog({
      actorUserId: userId,
      action: 'clinic.document_expiry_updated',
      entityType: 'ClinicDocument',
      entityId: documentId,
      clinicId,
      metadata: { previousExpiryDate: doc.expiryDate, newExpiryDate: expiryDate },
    });
    return toClinicDocumentDto(updated);
  },

  async getDashboard(userId: string, role: UserRole, clinicId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.CLINIC_VIEW);
    const clinic = await requireClinic(clinicId);

    const [clinicDoctors, staffCount, todayAppointments, activeDepartments, sessions] = await Promise.all([
      prisma.clinicDoctor.findMany({ where: { clinicId }, select: { status: true } }),
      prisma.clinicStaffMember.count({ where: { clinicId, isActive: true } }),
      prisma.appointment.findMany({
        where: { clinicId, scheduledAt: { gte: startOfDay(), lte: endOfDay() } },
        select: { status: true, consultationFee: true },
      }),
      prisma.department.count({ where: { clinicId, isActive: true } }),
      prisma.doctorSession.findMany({
        where: { clinicId, sessionDate: startOfDay() },
        include: { tokens: { where: { status: 'WAITING' }, select: { id: true } } },
      }),
    ]);

    const todayRevenue = todayAppointments
      .filter((a) => a.status === AppointmentStatus.COMPLETED && a.consultationFee)
      .reduce((sum, a) => sum + Number(a.consultationFee), 0);

    return {
      clinicId,
      clinicName: clinic.name,
      status: clinic.status,
      totalDoctors: clinicDoctors.length,
      activeDoctors: clinicDoctors.filter((d) => d.status === 'ACTIVE').length,
      totalStaff: staffCount,
      todayAppointments: todayAppointments.length,
      todayCheckedIn: todayAppointments.filter((a) => a.status === AppointmentStatus.CHECKED_IN).length,
      waitingPatients: sessions.reduce((sum, s) => sum + s.tokens.length, 0),
      completedConsultations: todayAppointments.filter((a) => a.status === AppointmentStatus.COMPLETED).length,
      cancelledAppointments: todayAppointments.filter((a) => a.status === AppointmentStatus.CANCELLED).length,
      noShows: todayAppointments.filter((a) => a.status === AppointmentStatus.NO_SHOW).length,
      todayRevenue: todayRevenue.toFixed(2),
      activeDepartments,
    };
  },
};
