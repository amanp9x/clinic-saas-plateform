import type {
  ClinicDocumentStatus,
  ClinicDocumentType,
  ClinicDoctorStatus,
  ClinicOperatingStatus,
  ClinicResourceStatus,
  ClinicResourceType,
  ClinicVerificationStatus,
  ConsultationType,
  DocumentExpiryStatus,
  DoctorSessionStatus,
  Gender,
  PatientDataVisibility,
  QueueStatus,
  StaffInvitationStatus,
  UserRole,
  Weekday,
} from '../enums.js';

export interface ClinicProfileDto {
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  clinicType: string | null;
  registrationNumber: string | null;
  description: string | null;
  photoUrl: string | null;
  coverImageUrl: string | null;
  email: string | null;
  phone: string | null;
  alternatePhone: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  country: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  establishedYear: number | null;
  languages: string[];
  facilities: string[];
  accessibilityInfo: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  timezone: string;
  status: ClinicOperatingStatus;
  statusReason: string | null;
  statusUpdatedAt: string | null;
  verificationStatus: ClinicVerificationStatus;
  verificationSubmittedAt: string | null;
  verificationNotes: string | null;
  /** Phase 15 — set once a Platform Admin has reviewed this clinic's verification submission. */
  verificationReviewedAt: string | null;
  verificationReviewNotes: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ClinicDocumentDto {
  id: string;
  clinicId: string;
  type: ClinicDocumentType;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  status: ClinicDocumentStatus;
  uploadedByUserId: string;
  uploadedByName: string | null;
  createdAt: string;
  /** Phase 17 — Compliance & Renewal. */
  expiryDate: string | null;
  expiryStatus: DocumentExpiryStatus;
}

export interface ClinicDashboardSummaryDto {
  clinicId: string;
  clinicName: string;
  status: ClinicOperatingStatus;
  totalDoctors: number;
  activeDoctors: number;
  totalStaff: number;
  todayAppointments: number;
  todayCheckedIn: number;
  waitingPatients: number;
  completedConsultations: number;
  cancelledAppointments: number;
  noShows: number;
  todayRevenue: string;
  activeDepartments: number;
}

export interface ClinicDoctorSummaryDto {
  clinicDoctorId: string;
  doctorId: string;
  doctorName: string;
  specializationName: string | null;
  yearsExperience: number | null;
  status: ClinicDoctorStatus;
  departmentId: string | null;
  departmentName: string | null;
  consultationFee: string | null;
  consultationDurationMinutes: number | null;
  consultationTypes: ConsultationType[];
  availableDays: Weekday[];
  queueEnabled: boolean;
  isAcceptingAppointments: boolean;
  startDate: string | null;
  endDate: string | null;
  currentDoctorStatus: DoctorSessionStatus | null;
  currentQueueStatus: QueueStatus | null;
}

export interface ClinicDoctorDetailDto extends ClinicDoctorSummaryDto {
  bio: string | null;
  gender: Gender | null;
  languages: string[];
  profileImageUrl: string | null;
  timings: string | null;
  canOverrideDelay: boolean;
}

export interface ExistingDoctorSearchResultDto {
  doctorId: string;
  doctorName: string;
  specializationName: string | null;
  yearsExperience: number | null;
  alreadyAssociated: boolean;
}

export interface DepartmentDto {
  id: string;
  clinicId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  displayOrder: number;
  doctorCount: number;
  serviceCount: number;
  createdAt: string;
}

export interface ClinicServiceDto {
  id: string;
  clinicId: string;
  departmentId: string | null;
  departmentName: string | null;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: string;
  taxApplicable: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface ClinicWorkingHoursSessionDto {
  id: string;
  startTime: string;
  endTime: string;
}

export interface ClinicWorkingHoursDto {
  id: string;
  weekday: Weekday;
  isOpen: boolean;
  sessions: ClinicWorkingHoursSessionDto[];
}

export interface ClinicHolidayDto {
  id: string;
  clinicId: string;
  date: string;
  name: string;
  description: string | null;
  isFullDay: boolean;
  startTime: string | null;
  endTime: string | null;
}

export interface ClinicResourceDto {
  id: string;
  clinicId: string;
  name: string;
  type: ClinicResourceType;
  code: string | null;
  floor: string | null;
  capacity: number | null;
  status: ClinicResourceStatus;
  createdAt: string;
}

export interface ClinicStaffSummaryDto {
  staffMemberId: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  title: string | null;
  permissions: string[];
  isActive: boolean;
  joinedAt: string;
  lastActiveAt: string | null;
}

export interface StaffInvitationDto {
  id: string;
  clinicId: string;
  email: string;
  role: UserRole;
  title: string | null;
  permissions: string[];
  status: StaffInvitationStatus;
  invitedByName: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export interface ClinicSettingsDto {
  clinicId: string;
  currency: string;
  defaultConsultationDurationMinutes: number;
  bufferMinutes: number;
  cancellationPolicy: string | null;
  noShowPolicy: string | null;
  queueEnabled: boolean;
  tokenPrefix: string | null;
  startingTokenNumber: number;
  dailyTokenReset: boolean;
  priorityQueueEnabled: boolean;
  emergencyPriorityEnabled: boolean;
  appointmentNotificationsEnabled: boolean;
  queueNotificationsEnabled: boolean;
  delayNotificationsEnabled: boolean;
  reminderMinutesBefore: number | null;
  patientDataVisibility: PatientDataVisibility;
}

export interface ClinicAuditLogEventDto {
  id: string;
  action: string;
  actorUserId: string | null;
  actorName: string | null;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ClinicDoctorPunctualityDto {
  doctorId: string;
  doctorName: string;
  averageDelayMinutes: number | null;
}

export interface ClinicReportsDto {
  range: { from: string; to: string };
  totalAppointments: number;
  completedConsultations: number;
  cancelledAppointments: number;
  noShows: number;
  walkIns: number;
  averageWaitMinutes: number | null;
  averageConsultationMinutes: number | null;
  totalDelayMinutes: number;
  doctorUtilization: ClinicDoctorPunctualityDto[];
  revenue: string;
}
