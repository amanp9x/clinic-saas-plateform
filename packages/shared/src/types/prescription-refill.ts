export type RefillRequestStatus = 'PENDING' | 'APPROVED' | 'DECLINED';

/** Shared by both the patient's "my refill requests" list and the doctor's review queue — same
 * underlying row, no reason to fork into two DTOs. */
export interface RefillRequestDto {
  id: string;
  prescriptionId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  status: RefillRequestStatus;
  patientNote: string | null;
  doctorNote: string | null;
  requestedAt: string;
  respondedAt: string | null;
  /** Set once a doctor approves — the id of the new DRAFT prescription cloned from the original,
   * which the doctor still reviews/finalizes through the existing prescription workflow. */
  issuedPrescriptionId: string | null;
  /** Read-only context about the prescription being refilled, so the doctor's queue and the
   * patient's tracker don't need a second fetch just to show what's being requested. */
  originalPrescription: {
    diagnosis: string | null;
    issuedAt: string;
    medicineNames: string[];
  };
}
