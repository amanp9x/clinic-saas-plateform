import type { ClinicDocumentDto } from './clinic.js';
import type { ClinicDocumentType, ClinicOperatingStatus, ClinicVerificationStatus, DocumentExpiryStatus } from '../enums.js';

/** Phase 15 — Platform Admin. `SUPER_ADMIN`/`PLATFORM_ADMIN` roles have existed since Phase 1
 * (bypassing clinic-permission checks) but had no actual platform-wide screens until now. */
export interface PlatformOverviewDto {
  totalClinics: number;
  verificationBreakdown: { status: ClinicVerificationStatus; count: number }[];
  totalDoctors: number;
  totalPatients: number;
  /** Phase 17 — Compliance & Renewal. */
  expiringDocumentsCount: number;
  expiredDocumentsCount: number;
}

export interface PlatformClinicRowDto {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  verificationStatus: ClinicVerificationStatus;
  operatingStatus: ClinicOperatingStatus;
  doctorCount: number;
  createdAt: string;
}

export interface PlatformClinicDetailDto extends PlatformClinicRowDto {
  legalName: string | null;
  registrationNumber: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  state: string | null;
  postalCode: string | null;
  verificationSubmittedAt: string | null;
  verificationNotes: string | null;
  verificationReviewedAt: string | null;
  verificationReviewNotes: string | null;
  staffCount: number;
  documents: ClinicDocumentDto[];
}

/** Phase 17 — Compliance & Renewal. One row per at-risk document, across every clinic — the
 * platform-wide compliance queue. */
export interface ComplianceDocumentRowDto {
  id: string;
  clinicId: string;
  clinicName: string;
  type: ClinicDocumentType;
  fileName: string;
  expiryDate: string;
  expiryStatus: DocumentExpiryStatus;
}
