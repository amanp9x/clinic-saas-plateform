import type { Clinic, ClinicDocument, ClinicSettings, User } from '@prisma/client';
import type { ClinicDocumentDto, ClinicProfileDto, ClinicSettingsDto } from '@clinic/shared';

export function toClinicProfileDto(clinic: Clinic): ClinicProfileDto {
  return {
    id: clinic.id,
    name: clinic.name,
    slug: clinic.slug,
    legalName: clinic.legalName,
    clinicType: clinic.clinicType,
    registrationNumber: clinic.registrationNumber,
    description: clinic.description,
    photoUrl: clinic.photoUrl,
    coverImageUrl: clinic.coverImageUrl,
    email: clinic.email,
    phone: clinic.phone,
    alternatePhone: clinic.alternatePhone,
    website: clinic.website,
    addressLine1: clinic.addressLine1,
    addressLine2: clinic.addressLine2,
    city: clinic.city,
    state: clinic.state,
    country: clinic.country,
    postalCode: clinic.postalCode,
    latitude: clinic.latitude,
    longitude: clinic.longitude,
    establishedYear: clinic.establishedYear,
    languages: clinic.languages,
    facilities: clinic.facilities,
    accessibilityInfo: clinic.accessibilityInfo,
    instagramUrl: clinic.instagramUrl,
    facebookUrl: clinic.facebookUrl,
    timezone: clinic.timezone,
    status: clinic.status,
    statusReason: clinic.statusReason,
    statusUpdatedAt: clinic.statusUpdatedAt ? clinic.statusUpdatedAt.toISOString() : null,
    verificationStatus: clinic.verificationStatus,
    verificationSubmittedAt: clinic.verificationSubmittedAt ? clinic.verificationSubmittedAt.toISOString() : null,
    verificationNotes: clinic.verificationNotes,
    isActive: clinic.isActive,
    createdAt: clinic.createdAt.toISOString(),
  };
}

export function toClinicDocumentDto(doc: ClinicDocument & { uploadedBy: User }): ClinicDocumentDto {
  return {
    id: doc.id,
    clinicId: doc.clinicId,
    type: doc.type,
    fileName: doc.fileName,
    fileSizeBytes: doc.fileSizeBytes,
    mimeType: doc.mimeType,
    status: doc.status,
    uploadedByUserId: doc.uploadedByUserId,
    uploadedByName: doc.uploadedBy.email ?? doc.uploadedBy.phone,
    createdAt: doc.createdAt.toISOString(),
  };
}

export function toClinicSettingsDto(settings: ClinicSettings): ClinicSettingsDto {
  return {
    clinicId: settings.clinicId,
    currency: settings.currency,
    defaultConsultationDurationMinutes: settings.defaultConsultationDurationMinutes,
    bufferMinutes: settings.bufferMinutes,
    cancellationPolicy: settings.cancellationPolicy,
    noShowPolicy: settings.noShowPolicy,
    queueEnabled: settings.queueEnabled,
    tokenPrefix: settings.tokenPrefix,
    startingTokenNumber: settings.startingTokenNumber,
    dailyTokenReset: settings.dailyTokenReset,
    priorityQueueEnabled: settings.priorityQueueEnabled,
    emergencyPriorityEnabled: settings.emergencyPriorityEnabled,
    appointmentNotificationsEnabled: settings.appointmentNotificationsEnabled,
    queueNotificationsEnabled: settings.queueNotificationsEnabled,
    delayNotificationsEnabled: settings.delayNotificationsEnabled,
    reminderMinutesBefore: settings.reminderMinutesBefore,
    patientDataVisibility: settings.patientDataVisibility,
  };
}

export const DEFAULT_CLINIC_SETTINGS_DTO: Omit<ClinicSettingsDto, 'clinicId'> = {
  currency: 'INR',
  defaultConsultationDurationMinutes: 15,
  bufferMinutes: 0,
  cancellationPolicy: null,
  noShowPolicy: null,
  queueEnabled: true,
  tokenPrefix: null,
  startingTokenNumber: 1,
  dailyTokenReset: true,
  priorityQueueEnabled: true,
  emergencyPriorityEnabled: true,
  appointmentNotificationsEnabled: true,
  queueNotificationsEnabled: true,
  delayNotificationsEnabled: true,
  reminderMinutesBefore: 60,
  patientDataVisibility: 'LIMITED',
};
