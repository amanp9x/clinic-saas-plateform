/** Shared between prisma/seed.ts and tests/ — kept in its own module (no side effects on
 * import) since seed.ts runs `main()` at import time and can't itself be imported safely. */
export const DEMO_PATIENT_EMAIL = 'patient@demo.example';
export const DEMO_PATIENT_PASSWORD = 'DemoPass123!';
