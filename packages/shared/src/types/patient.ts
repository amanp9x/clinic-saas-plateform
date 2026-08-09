import type { AppointmentStatus, Gender } from '../enums.js';

export interface PatientAddressDto {
  id: string;
  label: 'HOME' | 'WORK' | 'OTHER';
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string;
  isDefault: boolean;
}

export interface PatientProfileDto {
  id: string;
  email: string | null;
  phone: string | null;
  isEmailVerified: boolean;
  isMobileVerified: boolean;
  fullName: string;
  profileImageUrl: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  bloodGroup: string | null;
  allergies: string[];
  medicalConditions: string[];
  emergencyName: string | null;
  emergencyPhone: string | null;
  addresses: PatientAddressDto[];
}

export interface AppointmentSummaryDto {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorSlug: string;
  doctorProfileImageUrl: string | null;
  specializationName: string | null;
  clinicId: string;
  clinicName: string;
  clinicCity: string | null;
  scheduledAt: string;
  status: AppointmentStatus;
  tokenNumber: string | null;
  reasonForVisit: string | null;
  consultationFee: string | null;
  hasPrescription: boolean;
}

export interface AppointmentDetailDto extends AppointmentSummaryDto {
  clinicAddress: string | null;
  clinicPhone: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface MedicationItem {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
}

export interface PrescriptionDto {
  id: string;
  doctorName: string;
  appointmentId: string | null;
  issuedAt: string;
  medications: MedicationItem[];
  notes: string | null;
  fileUrl: string | null;
}

export interface LabReportDto {
  id: string;
  testName: string;
  labName: string | null;
  status: 'PENDING' | 'READY';
  reportDate: string | null;
  fileUrl: string | null;
  notes: string | null;
  appointmentId: string | null;
}

export interface VaccinationDto {
  id: string;
  vaccineName: string;
  doseNumber: number | null;
  administeredDate: string;
  nextDueDate: string | null;
  administeredBy: string | null;
  notes: string | null;
}

export interface VitalRecordDto {
  id: string;
  recordedAt: string;
  heightCm: number | null;
  weightKg: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  heartRateBpm: number | null;
  temperatureCelsius: number | null;
  bloodSugarMgDl: number | null;
  notes: string | null;
}

export interface MedicalRecordDto {
  id: string;
  recordType: 'CONSULTATION_NOTE' | 'DIAGNOSIS' | 'SURGERY' | 'HOSPITALIZATION' | 'OTHER';
  title: string;
  description: string | null;
  recordDate: string;
  doctorName: string | null;
  attachmentUrl: string | null;
}

export interface DownloadItemDto {
  id: string;
  kind: 'PRESCRIPTION' | 'LAB_REPORT';
  title: string;
  date: string;
  fileUrl: string | null;
}

export type NotificationTypeValue =
  | 'APPOINTMENT_UPDATE'
  | 'QUEUE_UPDATE'
  | 'PRESCRIPTION_READY'
  | 'REPORT_READY'
  | 'SYSTEM';

export interface NotificationDto {
  id: string;
  type: NotificationTypeValue;
  title: string;
  message: string;
  isRead: boolean;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
}

export interface NotificationPreferenceDto {
  appointmentUpdates: boolean;
  queueUpdates: boolean;
  prescriptionReady: boolean;
  reportReady: boolean;
  channel: 'EMAIL' | 'SMS' | 'BOTH' | 'NONE';
}

export interface DashboardSummaryDto {
  upcomingAppointment: AppointmentSummaryDto | null;
  todayAppointment: AppointmentSummaryDto | null;
  medicalRecordsCount: number;
  prescriptionsCount: number;
  labReportsPendingCount: number;
  labReportsReadyCount: number;
  unreadNotificationsCount: number;
}

/** Same honest "not started" contract as the Doctor Profile's queue status (Phase 2) —
 * no live-queue module exists yet, so `isActive` is always false until it does. */
export interface QueueViewDto {
  appointmentId: string;
  doctorName: string;
  clinicName: string;
  clinicId: string;
  appointmentTime: string;
  patientToken: string | null;
  isActive: boolean;
  currentToken: string | null;
  patientsAhead: number | null;
  estimatedWaitMinutes: number | null;
  delayMinutes: number | null;
  delayReason: string | null;
  doctorStatus: string | null;
  queueProgressPercent: number | null;
  lastUpdatedAt: string;
}
