/** Phase 11 — Analytics, Reporting & Operational Insights Engine. */

export const DATE_RANGE_PRESETS = ['today', 'yesterday', 'last7days', 'last30days', 'thisMonth', 'previousMonth', 'custom'] as const;
export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

export interface ResolvedDateRangeDto {
  preset: DateRangePreset;
  /** Inclusive start boundary, ISO 8601. */
  start: string;
  /** Exclusive end boundary, ISO 8601 — see [start, end) convention documented in analytics.util.ts. */
  end: string;
}

export interface AppointmentBreakdownDto {
  total: number;
  pending: number;
  confirmed: number;
  checkedIn: number;
  inConsultation: number;
  completed: number;
  cancelled: number;
  noShow: number;
  rescheduled: number;
  cancellationRate: number | null;
  noShowRate: number | null;
  completionRate: number | null;
  checkInRate: number | null;
}

export interface RevenueBreakdownDto {
  currency: string;
  grossCollected: number;
  refundedAmount: number;
  netCollected: number;
  pendingAmount: number;
  failedAmount: number;
  successfulPaymentCount: number;
  pendingPaymentCount: number;
  failedPaymentCount: number;
  refundedCount: number;
  averageTransactionValue: number | null;
}

export interface PaymentBreakdownDto {
  successRate: number | null;
  failureRate: number | null;
  refundRate: number | null;
  averageTransactionValue: number | null;
  byProvider: Array<{ provider: string; count: number; amount: number }>;
  byMethod: Array<{ method: string | null; count: number; amount: number }>;
}

export interface QueueBreakdownDto {
  checkedIn: number;
  called: number;
  skipped: number;
  completed: number;
  averageWaitingMinutes: number | null;
  medianWaitingMinutes: number | null;
  maximumWaitingMinutes: number | null;
  averageDelayMinutes: number | null;
  maximumDelayMinutes: number | null;
  averageQueueSize: number | null;
  peakQueueSize: number | null;
  throughput: number;
}

export interface PatientBreakdownDto {
  totalPatientsServed: number;
  newPatients: number;
  returningPatients: number;
  activePatients: number;
  averageAppointmentsPerPatient: number | null;
  repeatAppointmentRate: number | null;
}

export interface AnalyticsOverviewDto {
  clinicId: string;
  range: ResolvedDateRangeDto;
  appointments: AppointmentBreakdownDto;
  revenue: RevenueBreakdownDto;
  patients: {
    totalPatientsServed: number;
    newPatients: number;
    returningPatients: number;
  };
  averageConsultationMinutes: number | null;
  averageDelayMinutes: number | null;
  averageWaitingMinutes: number | null;
  queueThroughput: number;
  reviews: {
    clinicAverageRating: number | null;
    clinicReviewCount: number;
    doctorAverageRating: number | null;
    doctorReviewCount: number;
  };
}

export interface TrendPointDto {
  bucket: string;
  count: number;
  amount?: number;
}

export interface DoctorPerformanceRowDto {
  doctorId: string;
  doctorName: string;
  appointments: number;
  completed: number;
  cancelled: number;
  noShow: number;
  averageConsultationMinutes: number | null;
  averageWaitingMinutes: number | null;
  averageDelayMinutes: number | null;
  queueThroughput: number;
  revenue: number | null;
  reviewCount: number;
  averageRating: number | null;
  /** null when available capacity for the range is zero — see doctor-utilization.util.ts. */
  utilization: number | null;
}

export interface DoctorAvailabilityDto {
  doctorId: string;
  availableHours: number;
  bookedHours: number;
  consultationHours: number;
  leaveDays: number;
  utilization: number | null;
}

export interface DelayAnalyticsRowDto {
  doctorId: string;
  doctorName: string;
  delayedSessionCount: number;
  averageDelayMinutes: number | null;
  maximumDelayMinutes: number | null;
}

export interface ClinicComparisonRowDto {
  clinicId: string;
  clinicName: string;
  appointments: number;
  completed: number;
  cancelled: number;
  revenue: number;
  patients: number;
  averageWaitingMinutes: number | null;
  averageDoctorUtilization: number | null;
}

export type ReportType = 'appointments' | 'revenue' | 'doctors' | 'queue' | 'patients';

export interface AppointmentReportRowDto {
  appointmentId: string;
  bookingReference: string;
  patientName: string;
  doctorName: string;
  scheduledAt: string;
  status: string;
  consultationType: string;
  checkedInAt: string | null;
  completedAt: string | null;
}

export interface RevenueReportRowDto {
  paymentId: string;
  bookingReference: string;
  patientName: string;
  doctorName: string;
  status: string;
  amount: number;
  currency: string;
  method: string | null;
  capturedAt: string | null;
}

export interface QueueReportRowDto {
  sessionId: string;
  doctorId: string;
  doctorName: string;
  sessionDate: string;
  checkedIn: number;
  called: number;
  completed: number;
  skipped: number;
  averageWaitingMinutes: number | null;
  delayMinutes: number | null;
}

export interface PatientReportRowDto {
  patientId: string;
  patientName: string;
  appointments: number;
  completed: number;
  cancelled: number;
  noShow: number;
  firstVisitAt: string;
  isNewInRange: boolean;
}
