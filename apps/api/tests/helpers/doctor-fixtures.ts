import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Express } from 'express';
import { Gender, UserRole } from '@prisma/client';
import { prisma } from '../../src/config/database.js';
import { hashPassword } from '../../src/utils/password.js';
import { slugify } from '../../src/utils/slugify.js';

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

export async function createAppointmentFixture(input: {
  patientId: string;
  doctorId: string;
  clinicId: string;
  status?: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  scheduledAt?: Date;
  consultationFee?: number;
}) {
  return prisma.appointment.create({
    data: {
      patientId: input.patientId,
      doctorId: input.doctorId,
      clinicId: input.clinicId,
      status: input.status ?? 'CONFIRMED',
      scheduledAt: input.scheduledAt ?? todayAt(9, 0),
      consultationFee: input.consultationFee,
    },
  });
}
