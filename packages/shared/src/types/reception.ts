import type { AppointmentStatus, DoctorSessionStatus, Gender, QueueStatus, TokenPriority, TokenStatus, TokenType, UserRole } from '../enums.js';
import type { DoctorSessionDto, QueueTokenDto } from './doctor.js';

export interface ReceptionDoctorQueueStatusDto {
  doctorId: string;
  doctorName: string;
  status: DoctorSessionStatus;
  queueStatus: QueueStatus;
  currentTokenNumber: number | null;
  queueSize: number;
  delayMinutes: number | null;
  delayReason: string | null;
  estimatedWaitMinutes: number | null;
}

export interface ReceptionDashboardSummaryDto {
  clinicId: string;
  clinicName: string;
  todayTotalAppointments: number;
  checkedInCount: number;
  waitingCount: number;
  inConsultationCount: number;
  completedCount: number;
  noShowCount: number;
  walkInsCount: number;
  doctorQueues: ReceptionDoctorQueueStatusDto[];
}

export interface ReceptionAppointmentSummaryDto {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  tokenNumber: number | null;
  doctorId: string;
  doctorName: string;
  clinicId: string;
  scheduledAt: string;
  reasonForVisit: string | null;
  bookingSource: TokenType | 'BOOKED';
  status: AppointmentStatus;
  tokenStatus: TokenStatus | null;
  queuePosition: number | null;
  priority: TokenPriority | null;
}

export interface ReceptionAppointmentDetailDto extends ReceptionAppointmentSummaryDto {
  patientAge: number | null;
  patientGender: Gender | null;
  consultationFee: string | null;
  createdAt: string;
}

export interface ReceptionQueueTokenDto extends QueueTokenDto {
  priority: TokenPriority;
  patientsAhead: number | null;
  etaMinutes: number | null;
}

export interface ReceptionQueueSnapshotDto {
  session: DoctorSessionDto | null;
  pauseReason: string | null;
  currentToken: ReceptionQueueTokenDto | null;
  nextToken: ReceptionQueueTokenDto | null;
  waitingTokens: ReceptionQueueTokenDto[];
  calledTokens: ReceptionQueueTokenDto[];
  queueLength: number;
  completedTodayCount: number;
  skippedTodayCount: number;
  estimatedWaitMinutes: number | null;
  canUpdateDelay: boolean;
  canUpdatePriority: boolean;
}

export interface PatientSearchResultDto {
  id: string;
  fullName: string;
  age: number | null;
  gender: Gender | null;
  phone: string | null;
  profileImageUrl: string | null;
  lastAppointmentAt: string | null;
}

export interface PatientQuickViewDto {
  id: string;
  fullName: string;
  age: number | null;
  gender: Gender | null;
  phone: string | null;
  email: string | null;
  profileImageUrl: string | null;
  todayAppointment: ReceptionAppointmentSummaryDto | null;
}

export interface QueueHistoryEventDto {
  id: string;
  action: string;
  actorUserId: string | null;
  actorName: string | null;
  clinicId: string | null;
  doctorId: string | null;
  patientId: string | null;
  tokenId: string | null;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  createdAt: string;
}

export interface DoctorPunctualityDto {
  doctorId: string;
  doctorName: string;
  averageDelayMinutes: number | null;
  onTimeRate: number | null;
}

export interface PeakHourDto {
  hour: number;
  count: number;
}

export interface ReceptionReportsDto {
  range: { from: string; to: string };
  totalAppointments: number;
  checkedInCount: number;
  walkInsCount: number;
  noShowCount: number;
  averageWaitMinutes: number | null;
  averageConsultationMinutes: number | null;
  totalDelayMinutes: number;
  queueEfficiencyPercent: number | null;
  doctorPunctuality: DoctorPunctualityDto[];
  peakHours: PeakHourDto[];
}

export interface ClinicStaffProfileDto {
  userId: string;
  clinicId: string;
  clinicName: string;
  title: string | null;
  role: UserRole;
  permissions: string[];
  isActive: boolean;
}
