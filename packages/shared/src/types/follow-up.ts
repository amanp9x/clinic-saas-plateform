import type { ConsultationDto, DoctorPrescriptionDto } from './doctor.js';

/** Phase 14 — Follow-Up Care & Visit Summary. Reuses the existing doctor-facing
 * `ConsultationDto`/`DoctorPrescriptionDto` shapes rather than duplicating parallel patient-facing
 * DTOs — the underlying data (Consultation, Prescription) is identical either way. */
export interface VisitSummaryDto {
  appointmentId: string;
  doctorId: string;
  doctorName: string;
  doctorSlug: string;
  clinicId: string;
  clinicName: string;
  scheduledAt: string;
  consultation: ConsultationDto | null;
  prescription: DoctorPrescriptionDto | null;
}

/** A row in the doctor's or clinic's "follow-ups due" list. */
export interface FollowUpRowDto {
  consultationId: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  doctorId: string;
  doctorName: string;
  clinicId: string;
  clinicName: string;
  followUpDate: string;
  diagnosis: string | null;
  /** Server-computed — true once `followUpDate` is in the past (simple date comparison; does not
   * check whether the patient has since rebooked — see Known Limitations). */
  isOverdue: boolean;
}
