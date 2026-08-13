/**
 * Canonical clinic-staff permission keys. Granted per `ClinicStaffMember` row (see
 * `ClinicStaffMember.permissions String[]` in the Prisma schema) — a receptionist only gets the
 * actions explicitly listed here for a given clinic. `CLINIC_ADMIN` bypasses this list entirely
 * (still clinic-membership-checked) since an admin implicitly has every permission.
 */
export const CLINIC_PERMISSIONS = {
  QUEUE_VIEW: 'queue.view',
  QUEUE_MANAGE: 'queue.manage',
  QUEUE_DELAY_UPDATE: 'queue.delay.update',
  QUEUE_PAUSE: 'queue.pause',
  QUEUE_RESUME: 'queue.resume',
  QUEUE_PRIORITY_UPDATE: 'queue.priority.update',
  PATIENT_CHECKIN: 'patient.checkin',
  PATIENT_WALKIN_CREATE: 'patient.walkin.create',
  APPOINTMENT_MANAGE: 'appointment.manage',
  DOCTOR_STATUS_UPDATE: 'doctor.status.update',
  REPORTS_VIEW: 'reports.view',
} as const;

export type ClinicPermission = (typeof CLINIC_PERMISSIONS)[keyof typeof CLINIC_PERMISSIONS];

export const ALL_CLINIC_PERMISSIONS: ClinicPermission[] = Object.values(CLINIC_PERMISSIONS);
