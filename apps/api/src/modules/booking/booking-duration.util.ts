/**
 * The one and only place consultation-duration precedence is decided. Never hardcode a
 * duration anywhere else in the booking engine — always resolve it through this function.
 *
 * Precedence: the specific DoctorAvailability session template that matched → the doctor's
 * clinic-level override → the clinic's configured default → a final hardcoded fallback (15,
 * matching `eta.service.ts`'s own DEFAULT_CONSULTATION_MINUTES for consistency).
 */
export function resolveConsultationDuration(input: {
  sessionDurationMinutes?: number | null;
  clinicDoctorOverrideMinutes?: number | null;
  clinicDefaultMinutes?: number | null;
}): number {
  return (
    input.sessionDurationMinutes ??
    input.clinicDoctorOverrideMinutes ??
    input.clinicDefaultMinutes ??
    15
  );
}
