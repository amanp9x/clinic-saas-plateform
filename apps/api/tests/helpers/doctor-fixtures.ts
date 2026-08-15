import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Express } from 'express';
import type { Weekday } from '@prisma/client';
import { Gender, UserRole } from '@prisma/client';
import { prisma } from '../../src/config/database.js';
import { hashPassword } from '../../src/utils/password.js';
import { slugify } from '../../src/utils/slugify.js';
import { generateBookingReference } from '../../src/modules/booking/booking-reference.util.js';
import { parseTimeString } from '../../src/utils/time.util.js';
import { weekdayForDate } from '../../src/utils/weekday.js';

export const FRESH_DOCTOR_PASSWORD = 'FreshDoc123!';
export const FRESH_PATIENT_PASSWORD = 'FreshPat123!';

/**
 * Creates a fully isolated Doctor + Clinic + ClinicDoctor fixture with a unique email/slug per
 * call (via randomUUID), so doctor-portal tests never collide with each other or with the
 * seeded demo doctor's data across repeated test runs — no shared-state reset needed.
 */
export async function createDoctorFixture(app: Express, opts: { canOverrideDelay?: boolean } = {}) {
  const suffix = randomUUID().slice(0, 8);
  const clinic = await prisma.clinic.create({
    data: { name: `Test Clinic ${suffix}`, slug: `test-clinic-${suffix}` },
  });

  const passwordHash = await hashPassword(FRESH_DOCTOR_PASSWORD);
  const email = `doctor-fixture-${suffix}@example.com`;
  const user = await prisma.user.create({
    data: { email, passwordHash, role: UserRole.DOCTOR, isEmailVerified: true, isActive: true },
  });
  const doctor = await prisma.doctor.create({
    data: {
      userId: user.id,
      slug: slugify(`Dr Fixture ${suffix}`),
      displayName: `Dr. Fixture ${suffix}`,
      gender: Gender.OTHER,
      languages: ['English'],
      consultationFee: 500,
    },
  });
  const clinicDoctor = await prisma.clinicDoctor.create({
    data: {
      clinicId: clinic.id,
      doctorId: doctor.id,
      canOverrideDelay: opts.canOverrideDelay ?? false,
    },
  });

  const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: FRESH_DOCTOR_PASSWORD });
  if (loginRes.status !== 200) {
    throw new Error(`Doctor fixture login failed: ${JSON.stringify(loginRes.body)}`);
  }

  return {
    token: loginRes.body.data.accessToken as string,
    userId: user.id,
    doctorId: doctor.id,
    clinicId: clinic.id,
    clinicDoctorId: clinicDoctor.id,
  };
}

export async function createPatientFixture(app: Express) {
  const suffix = randomUUID().slice(0, 8);
  const email = `patient-fixture-${suffix}@example.com`;
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: FRESH_PATIENT_PASSWORD, fullName: `Fixture Patient ${suffix}` });
  if (res.status !== 201) {
    throw new Error(`Patient fixture registration failed: ${JSON.stringify(res.body)}`);
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const patient = await prisma.patient.findUniqueOrThrow({ where: { userId: user.id } });
  return { token: res.body.data.accessToken as string, userId: user.id, patientId: patient.id };
}

export function todayAt(hour: number, minute = 0): Date {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

/** Booking tests need a date guaranteed to be in the future (so "past-today" slot filtering
 * never interferes) alongside its matching Weekday enum value, for setting up
 * DoctorAvailability/ClinicWorkingHours fixtures. Always "tomorrow" — never a fixed calendar
 * date — so tests keep working correctly regardless of what day they're actually run on. */
export function tomorrowInfo(): { date: string; weekday: Weekday; dateObj: Date } {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return { date: `${y}-${m}-${day}`, weekday: weekdayForDate(d), dateObj: d };
}

/** Builds the Date for a specific "HH:mm" time on the given day (local time), matching how the
 * booking engine constructs slot timestamps. */
export function atTime(dayStart: Date, hhmm: string): Date {
  const [hour, minute] = hhmm.split(':').map(Number);
  const d = new Date(dayStart);
  d.setHours(hour!, minute!, 0, 0);
  return d;
}

/** Monotonically-increasing minute offset applied to the default `scheduledAt` below, so that
 * repeated `createAppointmentFixture` calls for the same doctor+clinic within one test file never
 * collide on the new (doctorId, clinicId, scheduledAt) partial-unique constraint (Phase 8) —
 * without this, two fixture appointments created a moment apart for the same doctor would both
 * silently default to the identical `todayAt(9, 0)` timestamp. */
let defaultSlotCounter = 0;

export async function createAppointmentFixture(input: {
  patientId: string;
  doctorId: string;
  clinicId: string;
  status?: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  scheduledAt?: Date;
  consultationFee?: number;
}) {
  const scheduledAt = input.scheduledAt ?? todayAt(9, defaultSlotCounter++ % 480);
  return prisma.appointment.create({
    data: {
      patientId: input.patientId,
      doctorId: input.doctorId,
      clinicId: input.clinicId,
      status: input.status ?? 'CONFIRMED',
      scheduledAt,
      consultationFee: input.consultationFee,
      bookingReference: generateBookingReference(scheduledAt),
    },
  });
}

/** Weekly DoctorAvailability template row — booking tests need real availability data (unlike
 * most other fixtures, `createDoctorFixture` alone only creates a bare ClinicDoctor row with no
 * schedule). Times are "HH:mm" strings, converted via the shared `parseTimeString` convention. */
export function createDoctorAvailabilityFixture(
  clinicDoctorId: string,
  input: { weekday: Weekday; startTime: string; endTime: string; consultationDurationMinutes?: number; breakStartTime?: string; breakEndTime?: string },
) {
  return prisma.doctorAvailability.create({
    data: {
      clinicDoctorId,
      weekday: input.weekday,
      startTime: parseTimeString(input.startTime),
      endTime: parseTimeString(input.endTime),
      consultationDurationMinutes: input.consultationDurationMinutes ?? 15,
      breakStartTime: input.breakStartTime ? parseTimeString(input.breakStartTime) : undefined,
      breakEndTime: input.breakEndTime ? parseTimeString(input.breakEndTime) : undefined,
    },
  });
}

/** Clinic-level weekly working-hours row (with sessions) — booking tests need the clinic to be
 * "open" on the target weekday, independent of the doctor's own availability template. */
export function createClinicWorkingHoursFixture(
  clinicId: string,
  input: { weekday: Weekday; sessions: { startTime: string; endTime: string }[] },
) {
  return prisma.clinicWorkingHours.create({
    data: {
      clinicId,
      weekday: input.weekday,
      isOpen: true,
      sessions: {
        create: input.sessions.map((s) => ({ startTime: parseTimeString(s.startTime), endTime: parseTimeString(s.endTime) })),
      },
    },
    include: { sessions: true },
  });
}
