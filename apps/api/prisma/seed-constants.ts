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
