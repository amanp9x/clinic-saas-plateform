import type {
  AppointmentStatus,
  ConsultationStatus,
  DoctorSessionStatus,
  FoodTiming,
  Gender,
  LeaveType,
  PaymentTransactionStatus,
  PrescriptionStatus,
  QueueStatus,
  TokenPriority,
  TokenStatus,
  TokenType,
  Weekday,
} from '../enums.js';
import type {
  AppointmentSummaryDto,
  LabReportDto,
  MedicalRecordDto,
  PrescriptionDto as PatientPrescriptionDto,
  VaccinationDto,
  VitalRecordDto,
} from './patient.js';

export interface DoctorAppointmentSummaryDto {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number | null;
  patientGender: Gender | null;
  patientProfileImageUrl: string | null;
  scheduledAt: string;
  reasonForVisit: string | null;
  tokenNumber: string | null;
  clinicId: string;
  clinicName: string;
  status: AppointmentStatus;
  consultationFee: string | null;
  hasPrescription: boolean;
  /** Phase 9 — limited financial visibility: status only, never provider/payment-method detail. */
  paymentStatus: PaymentTransactionStatus | null;
}

export interface DoctorAppointmentDetailDto extends DoctorAppointmentSummaryDto {
  patientPhone: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  consultationStatus: ConsultationStatus | null;
}

export interface DoctorDashboardClinicStatusDto {
  clinicId: string;
  clinicName: string;
  status: DoctorSessionStatus;
  queueStatus: QueueStatus;
  currentTokenNumber: number | null;
  waitingCount: number;
  delayMinutes: number | null;
}

export interface DoctorDashboardSummaryDto {
  todayAppointmentsCount: number;
  upcomingAppointmentsCount: number;
  completedConsultationsCount: number;
  pendingConsultationsCount: number;
  todayPatientsCount: number;
  clinicStatuses: DoctorDashboardClinicStatusDto[];
  waitingPatientsCount: number;
  averageConsultationMinutes: number | null;
  todaysEarnings: string;
  ratingAverage: number | null;
  ratingCount: number;
  nextAppointment: DoctorAppointmentSummaryDto | null;
}

export interface DoctorProfileDto {
  id: string;
  slug: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  specializationId: string | null;
  specializationName: string | null;
  qualifications: string | null;
  bio: string | null;
  gender: Gender | null;
  languages: string[];
  yearsExperience: number | null;
  consultationFee: string | null;
  profileImageUrl: string | null;
  onlineConsultation: boolean;
  ratingAverage: number | null;
  ratingCount: number;
  isActive: boolean;
}

export interface ClinicAssociationDto {
  clinicId: string;
  clinicName: string;
  clinicSlug: string;
  city: string | null;
  isActive: boolean;
  timings: string | null;
  availableDays: Weekday[];
  consultationFeeOverride: string | null;
  consultationDurationMinutesOverride: number | null;
  isAcceptingAppointments: boolean;
  canOverrideDelay: boolean;
  effectiveConsultationFee: string | null;
}

export interface DoctorScheduleSlotDto {
  id: string;
  clinicId: string;
  clinicName: string;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  consultationDurationMinutes: number;
  breakStartTime: string | null;
  breakEndTime: string | null;
  isActive: boolean;
}

export interface DoctorLeaveDto {
  id: string;
  clinicId: string | null;
  clinicName: string | null;
  startDate: string;
  endDate: string;
  reason: string | null;
  type: LeaveType;
}

/** Phase 19 — Doctor Leave conflict resolution. One row per appointment that was automatically
 * cancelled because it fell inside a newly-created leave's date range. */
export interface CancelledLeaveConflictDto {
  appointmentId: string;
  bookingReference: string;
  patientName: string;
  clinicName: string;
  scheduledAt: string;
}

export interface LeaveCreateResultDto {
  leave: DoctorLeaveDto;
  cancelledAppointments: CancelledLeaveConflictDto[];
}

export interface DoctorSessionDto {
  id: string;
  doctorId: string;
  clinicId: string;
  clinicName: string;
  sessionDate: string;
  status: DoctorSessionStatus;
  queueStatus: QueueStatus;
  startedAt: string | null;
  endedAt: string | null;
  currentTokenId: string | null;
  averageConsultationMinutes: number | null;
  delayMinutes: number | null;
  delayReason: string | null;
  delayUpdatedAt: string | null;
}

export interface QueueTokenDto {
  id: string;
  tokenNumber: number;
  type: TokenType;
  status: TokenStatus;
  patientId: string;
  patientName: string;
  appointmentId: string | null;
  calledAt: string | null;
  calledCount: number;
  startedAt: string | null;
  completedAt: string | null;
  skipReason: string | null;
  priority: TokenPriority;
}

export interface QueueSnapshotDto {
  session: DoctorSessionDto | null;
  currentToken: QueueTokenDto | null;
  waitingTokens: QueueTokenDto[];
  calledTokens: QueueTokenDto[];
  queueLength: number;
  completedTodayCount: number;
  skippedTodayCount: number;
  canOverrideDelay: boolean;
}

export interface DoctorPatientProfileDto {
  id: string;
  fullName: string;
  profileImageUrl: string | null;
  dateOfBirth: string | null;
  age: number | null;
  gender: Gender | null;
  bloodGroup: string | null;
  allergies: string[];
  medicalConditions: string[];
  phone: string | null;
  email: string | null;
}

export interface PatientMedicalHistoryDto {
  profile: DoctorPatientProfileDto;
  appointments: AppointmentSummaryDto[];
  prescriptions: PatientPrescriptionDto[];
  labReports: LabReportDto[];
  vaccinations: VaccinationDto[];
  vitalRecords: VitalRecordDto[];
  medicalRecords: MedicalRecordDto[];
}

export interface ConsultationVitalsDto {
  heightCm: number | null;
  weightKg: number | null;
  temperatureC: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  pulseRate: number | null;
  respiratoryRate: number | null;
  spo2: number | null;
}

export interface ConsultationDto {
  id: string;
  appointmentId: string;
  status: ConsultationStatus;
  chiefComplaint: string | null;
  symptoms: string[];
  vitals: ConsultationVitalsDto;
  diagnosis: string | null;
  doctorNotes: string | null;
  treatmentPlan: string | null;
  followUpDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface PrescriptionItemDto {
  id: string;
  sortOrder: number;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string | null;
  instructions: string | null;
  beforeAfterFood: FoodTiming | null;
  quantity: string | null;
}

export interface DoctorPrescriptionDto {
  id: string;
  patientId: string;
  patientName: string;
  appointmentId: string | null;
  consultationId: string | null;
  status: PrescriptionStatus;
  diagnosis: string | null;
  advice: string | null;
  followUpDate: string | null;
  labTestRecommendation: string[];
  items: PrescriptionItemDto[];
  notes: string | null;
  signedAt: string | null;
  signatureImageUrl: string | null;
  pdfUrl: string | null;
  issuedAt: string;
}

export interface DoctorEarningsSummaryDto {
  range: 'today' | 'week' | 'month';
  totalEarnings: string;
  completedConsultations: number;
  platformCommissionPercent: number;
  platformCommissionAmount: string;
  netEarnings: string;
  pendingSettlements: string;
}

export interface DoctorReviewDetailDto {
  id: string;
  authorName: string;
  rating: number;
  comment: string | null;
  consultationExperience: number | null;
  communication: number | null;
  professionalism: number | null;
  explanationClarity: number | null;
  status: string;
  createdAt: string;
  response: string | null;
  respondedAt: string | null;
}

export interface ReviewRatingBreakdownDto {
  rating: number;
  count: number;
}

export interface ReviewDimensionAveragesDto {
  consultationExperience: number | null;
  communication: number | null;
  professionalism: number | null;
  explanationClarity: number | null;
}

export interface ReviewTrendPointDto {
  bucket: string;
  count: number;
  averageRating: number | null;
}

export interface DoctorReviewSummaryDto {
  ratingAverage: number | null;
  ratingCount: number;
  breakdown: ReviewRatingBreakdownDto[];
  dimensionAverages: ReviewDimensionAveragesDto;
  trend: ReviewTrendPointDto[];
  recentReviews: DoctorReviewDetailDto[];
}

export interface DoctorSignatureDto {
  signatureImageUrl: string | null;
  signatureText: string | null;
  updatedAt: string | null;
}
