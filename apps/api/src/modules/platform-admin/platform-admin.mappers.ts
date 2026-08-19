import type { ClinicDocument, User } from '@prisma/client';
import type { ComplianceDocumentRowDto, PlatformClinicDetailDto, PlatformClinicRowDto } from '@clinic/shared';
import { toClinicDocumentDto } from '../clinic/clinic.mappers.js';
import { computeDocumentExpiryStatus } from '../../utils/document-expiry.util.js';
import type { ComplianceDocumentRowWithRelations, PlatformClinicDetailWithRelations, PlatformClinicRowWithRelations } from './platform-admin.repository.js';

export function toPlatformClinicRowDto(clinic: PlatformClinicRowWithRelations): PlatformClinicRowDto {
  return {
    id: clinic.id,
    name: clinic.name,
    slug: clinic.slug,
    city: clinic.city,
    verificationStatus: clinic.verificationStatus,
    operatingStatus: clinic.status,
    doctorCount: clinic._count.doctors,
    createdAt: clinic.createdAt.toISOString(),
  };
}

export function toPlatformClinicDetailDto(
  clinic: PlatformClinicDetailWithRelations,
  documents: (ClinicDocument & { uploadedBy: User })[],
): PlatformClinicDetailDto {
  return {
    id: clinic.id,
    name: clinic.name,
    slug: clinic.slug,
    city: clinic.city,
    verificationStatus: clinic.verificationStatus,
    operatingStatus: clinic.status,
    doctorCount: clinic._count.doctors,
    createdAt: clinic.createdAt.toISOString(),
    legalName: clinic.legalName,
    registrationNumber: clinic.registrationNumber,
    email: clinic.email,
    phone: clinic.phone,
    addressLine1: clinic.addressLine1,
    state: clinic.state,
    postalCode: clinic.postalCode,
    verificationSubmittedAt: clinic.verificationSubmittedAt ? clinic.verificationSubmittedAt.toISOString() : null,
    verificationNotes: clinic.verificationNotes,
    verificationReviewedAt: clinic.verificationReviewedAt ? clinic.verificationReviewedAt.toISOString() : null,
    verificationReviewNotes: clinic.verificationReviewNotes,
    staffCount: clinic._count.staff,
    documents: documents.map(toClinicDocumentDto),
  };
}

export function toComplianceDocumentRowDto(doc: ComplianceDocumentRowWithRelations): ComplianceDocumentRowDto {
  return {
    id: doc.id,
    clinicId: doc.clinicId,
    clinicName: doc.clinic.name,
    type: doc.type,
    fileName: doc.fileName,
    expiryDate: doc.expiryDate!.toISOString().slice(0, 10),
    expiryStatus: computeDocumentExpiryStatus(doc.expiryDate),
  };
}
