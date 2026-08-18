import { NotificationType, type ClinicVerificationStatus } from '@prisma/client';
import { SOCKET_EVENTS } from '@clinic/shared';
import type {
  ClinicDocumentStatusUpdateInput,
  ClinicVerificationUpdateInput,
  PaginatedResult,
  PlatformClinicDetailDto,
  PlatformClinicListQuery,
  PlatformClinicRowDto,
  PlatformOverviewDto,
} from '@clinic/shared';
import { platformAdminRepository } from './platform-admin.repository.js';
import { toPlatformClinicDetailDto, toPlatformClinicRowDto } from './platform-admin.mappers.js';
import { clinicRepository } from '../clinic/clinic.repository.js';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom } from '../../sockets/emit.js';
import { notifyUser } from '../notifications/notification-dispatch.service.js';
import { env } from '../../config/env.js';

/** Admin-settable target states only — PENDING/SUBMITTED are clinic-driven and never set by an
 * admin action, so they're not keys here. Mirrors the exact real-world review lifecycle: a
 * submission gets picked up (UNDER_REVIEW) then approved/rejected; a rejected clinic can be
 * reopened for review after fixing issues; a verified clinic can later be suspended for
 * compliance and reinstated. */
const ALLOWED_TRANSITIONS: Record<ClinicVerificationStatus, ClinicVerificationStatus[]> = {
  PENDING: [],
  SUBMITTED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['VERIFIED', 'REJECTED'],
  VERIFIED: ['SUSPENDED'],
  REJECTED: ['UNDER_REVIEW'],
  SUSPENDED: ['VERIFIED'],
};

/** The clinic admin portal is single-clinic-scoped per session (derived from auth context, not a
 * URL param) — there is no per-clinic slug in its routes, unlike the public catalog. */
function clinicProfileUrl(): string {
  return `${env.WEB_URL}/clinic/profile`;
}

export const platformAdminService = {
  async getOverview(): Promise<PlatformOverviewDto> {
    const { totalClinics, verificationGroups, totalDoctors, totalPatients } = await platformAdminRepository.overview();
    return {
      totalClinics,
      verificationBreakdown: verificationGroups.map((g) => ({ status: g.verificationStatus, count: g._count })),
      totalDoctors,
      totalPatients,
    };
  },

  async listClinics(query: PlatformClinicListQuery): Promise<PaginatedResult<PlatformClinicRowDto>> {
    const { items, total } = await platformAdminRepository.listClinics({
      verificationStatus: query.verificationStatus,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
    return {
      items: items.map(toPlatformClinicRowDto),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  },

  async getClinicDetail(id: string): Promise<PlatformClinicDetailDto> {
    const clinic = await platformAdminRepository.findClinicDetail(id);
    if (!clinic) {
      throw new NotFoundError('Clinic');
    }
    const documents = await clinicRepository.listDocuments(id);
    return toPlatformClinicDetailDto(clinic, documents);
  },

  async updateVerification(actorUserId: string, id: string, input: ClinicVerificationUpdateInput): Promise<PlatformClinicDetailDto> {
    const clinic = await platformAdminRepository.findClinicDetail(id);
    if (!clinic) {
      throw new NotFoundError('Clinic');
    }
    if (!ALLOWED_TRANSITIONS[clinic.verificationStatus].includes(input.status)) {
      throw new ConflictError(`Cannot move a clinic from ${clinic.verificationStatus} to ${input.status}`);
    }
    if ((input.status === 'REJECTED' || input.status === 'SUSPENDED') && !input.notes?.trim()) {
      throw new ValidationError('A reason is required to reject or suspend a clinic');
    }

    const updated = await platformAdminRepository.updateVerification(id, {
      verificationStatus: input.status,
      verificationReviewNotes: input.notes || null,
      verificationReviewedByUserId: actorUserId,
    });

    recordAuditLog({
      actorUserId,
      action: 'platform.clinic_verification_updated',
      entityType: 'Clinic',
      entityId: id,
      clinicId: id,
      metadata: { previousStatus: clinic.verificationStatus, newStatus: input.status, notes: input.notes || null },
    });

    const admins = await platformAdminRepository.clinicAdminUserIds(id);
    const outcomeLabel = input.status === 'VERIFIED' ? 'verified' : input.status === 'SUSPENDED' ? 'suspended' : input.status === 'REJECTED' ? 'rejected' : 'moved into review';
    for (const admin of admins) {
      await notifyUser({
        userId: admin.userId,
        type: NotificationType.CLINIC_VERIFICATION_UPDATED,
        title: `Clinic verification ${outcomeLabel}`,
        message:
          input.status === 'REJECTED' || input.status === 'SUSPENDED'
            ? `${clinic.name} was ${outcomeLabel}.${input.notes ? ` Reason: ${input.notes}` : ''}`
            : `${clinic.name} has been ${outcomeLabel}.`,
        relatedEntityType: 'Clinic',
        relatedEntityId: id,
        actionUrl: clinicProfileUrl(),
        notificationKey: `clinic:${id}:verification:${input.status}:${updated.verificationReviewedAt!.getTime()}`,
      });
    }
    emitToClinicRoom(id, SOCKET_EVENTS.CLINIC.VERIFICATION_UPDATED, { clinicId: id, status: input.status });

    const documents = await clinicRepository.listDocuments(id);
    return toPlatformClinicDetailDto(updated, documents);
  },

  async updateDocumentStatus(actorUserId: string, clinicId: string, documentId: string, input: ClinicDocumentStatusUpdateInput): Promise<PlatformClinicDetailDto> {
    const clinic = await platformAdminRepository.findClinicDetail(clinicId);
    if (!clinic) {
      throw new NotFoundError('Clinic');
    }
    const document = await clinicRepository.findDocument(documentId, clinicId);
    if (!document) {
      throw new NotFoundError('Document');
    }

    await platformAdminRepository.updateDocumentStatus(documentId, input.status);
    recordAuditLog({
      actorUserId,
      action: `platform.clinic_document_${input.status.toLowerCase()}`,
      entityType: 'ClinicDocument',
      entityId: documentId,
      clinicId,
      metadata: { fileName: document.fileName, notes: input.notes || null },
    });

    const documents = await clinicRepository.listDocuments(clinicId);
    return toPlatformClinicDetailDto(clinic, documents);
  },
};
