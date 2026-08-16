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

  // Phase 6 — Clinic Management. Additive only: nothing above this line is removed or renamed,
  // so every existing Reception/Doctor permission check keeps working unchanged.
  CLINIC_VIEW: 'clinic.view',
  CLINIC_UPDATE: 'clinic.update',
  CLINIC_DOCUMENTS_MANAGE: 'clinic.documents.manage',
  DOCTOR_VIEW: 'doctor.view',
  DOCTOR_MANAGE: 'doctor.manage',
  DOCTOR_SCHEDULE_MANAGE: 'doctor.schedule.manage',
  STAFF_VIEW: 'staff.view',
  STAFF_MANAGE: 'staff.manage',
  STAFF_PERMISSIONS_MANAGE: 'staff.permissions.manage',
  DEPARTMENT_VIEW: 'department.view',
  DEPARTMENT_MANAGE: 'department.manage',
  SERVICE_VIEW: 'service.view',
  SERVICE_MANAGE: 'service.manage',
  SCHEDULE_VIEW: 'schedule.view',
  SCHEDULE_MANAGE: 'schedule.manage',
  HOLIDAY_VIEW: 'holiday.view',
  HOLIDAY_MANAGE: 'holiday.manage',
  RESOURCE_VIEW: 'resource.view',
  RESOURCE_MANAGE: 'resource.manage',

  // Phase 9 — Payments & Billing. `payment.create`/`payment.verify` are intentionally absent here:
  // those are patient-owned actions gated by authentication + ownership (same idiom as booking),
  // not clinic-staff permissions. `invoice.view`/`invoice.download` are folded into BILLING_VIEW
  // rather than fragmented further — this codebase's convention is one permission per screen/action
  // group, not one per button.
  PAYMENT_VIEW: 'payment.view',
  PAYMENT_REFUND: 'payment.refund',
  BILLING_VIEW: 'billing.view',

  // Phase 10 — Notifications & Communication.
  NOTIFICATION_ANNOUNCE: 'notification.announce',
} as const;

export type ClinicPermission = (typeof CLINIC_PERMISSIONS)[keyof typeof CLINIC_PERMISSIONS];

export const ALL_CLINIC_PERMISSIONS: ClinicPermission[] = Object.values(CLINIC_PERMISSIONS);
