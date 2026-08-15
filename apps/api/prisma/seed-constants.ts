/** Shared between prisma/seed.ts and tests/ — kept in its own module (no side effects on
 * import) since seed.ts runs `main()` at import time and can't itself be imported safely. */
export const DEMO_PATIENT_EMAIL = 'patient@demo.example';
export const DEMO_PATIENT_PASSWORD = 'DemoPass123!';

/** The seeded "Dr. Aditi Sharma" doctor account (slug `dr-aditi-sharma`), given a password so
 * it can log in through the normal /auth/login flow — used by both the Doctor Portal manual
 * smoke test and its integration tests. */
export const DEMO_DOCTOR_EMAIL = 'aditi.sharma@doctors.example';
export const DEMO_DOCTOR_PASSWORD = 'DemoPass123!';
export const DEMO_DOCTOR_SLUG = 'dr-aditi-sharma';

/** The seeded receptionist account at Sunrise Family Clinic, granted every CLINIC_PERMISSIONS
 * key — used by the Reception Portal manual smoke test and its integration tests. */
export const DEMO_RECEPTIONIST_EMAIL = 'reception@sunrise.example';
export const DEMO_RECEPTIONIST_PASSWORD = 'DemoPass123!';

/** The seeded Clinic Admin account at Sunrise Family Clinic — CLINIC_ADMIN role bypasses the
 * individual CLINIC_PERMISSIONS checks entirely (see reception.shared.ts::assertClinicPermission),
 * so no explicit permissions list is needed. Used by the Clinic Management Portal smoke test. */
export const DEMO_CLINIC_ADMIN_EMAIL = 'admin@sunrise.example';
export const DEMO_CLINIC_ADMIN_PASSWORD = 'DemoPass123!';
