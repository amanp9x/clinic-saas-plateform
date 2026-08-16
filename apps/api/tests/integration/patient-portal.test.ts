import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { sendEmailMock, sendSmsMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn((_args: { to: string; subject: string; html: string; text: string }) =>
    Promise.resolve(),
  ),
  sendSmsMock: vi.fn((_args: { to: string; message: string }) => Promise.resolve()),
}));

vi.mock('../../src/services/mailer.service.js', () => ({ sendEmail: sendEmailMock }));
vi.mock('../../src/services/sms.service.js', () => ({ sendSms: sendSmsMock }));

const { createApp } = await import('../../src/app.js');
const { prisma } = await import('../../src/config/database.js');
const { DEMO_PATIENT_EMAIL, DEMO_PATIENT_PASSWORD } = await import('../../prisma/seed-constants.js');
const { AppointmentStatus } = await import('@prisma/client');
const { resetAuthTables } = await import('../helpers/db.js');
const { generateBookingReference } = await import('../../src/modules/booking/booking-reference.util.js');

const app = createApp();

function extractCode(text: string): string {
  const match = /\b(\d{6})\b/.exec(text);
  if (!match) throw new Error(`No 6-digit code found in: ${text}`);
  return match[1]!;
}

async function loginDemoPatient(): Promise<string> {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: DEMO_PATIENT_EMAIL, password: DEMO_PATIENT_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`Demo patient login failed: ${JSON.stringify(res.body)}`);
  }
  return res.body.data.accessToken;
}

let demoToken: string;

async function registerFreshPatient(email: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: 'FreshPass123!', fullName: 'Fresh Patient' });
  const token = res.body.data.accessToken as string;
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const patient = await prisma.patient.findUniqueOrThrow({ where: { userId: user.id } });
  return { token, userId: user.id, patientId: patient.id };
}

async function seedAppointmentFor(
  patientId: string,
  status: (typeof AppointmentStatus)[keyof typeof AppointmentStatus],
  scheduledAt: Date,
) {
  const doctor = await prisma.doctor.findFirstOrThrow({ where: { slug: 'dr-aditi-sharma' } });
  const clinic = await prisma.clinic.findFirstOrThrow({ where: { slug: 'sunrise-family-clinic' } });
  return prisma.appointment.create({
    data: { patientId, doctorId: doctor.id, clinicId: clinic.id, status, scheduledAt, bookingReference: generateBookingReference(scheduledAt) },
  });
}

beforeAll(async () => {
  // Clears any leftover fresh-patient rows from a previous run of this file (or others) —
  // this file registers many one-off patients and doesn't clean up after each test.
  await resetAuthTables();
  demoToken = await loginDemoPatient();
});

describe('GET /api/v1/dashboard/summary', () => {
  it('returns real aggregated counts for the demo patient', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${demoToken}`);
    expect(res.status).toBe(200);
    const { summary } = res.body.data;
    expect(summary.upcomingAppointment).not.toBeNull();
    expect(summary.todayAppointment).not.toBeNull();
    expect(summary.medicalRecordsCount).toBeGreaterThan(0);
    expect(summary.prescriptionsCount).toBeGreaterThan(0);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/dashboard/summary');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/appointments', () => {
  it('lists upcoming appointments', async () => {
    const res = await request(app)
      .get('/api/v1/appointments?tab=upcoming')
      .set('Authorization', `Bearer ${demoToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    expect(res.body.data.items[0].status).not.toBe('CANCELLED');
  });

  it('lists completed appointments', async () => {
    const res = await request(app)
      .get('/api/v1/appointments?tab=completed')
      .set('Authorization', `Bearer ${demoToken}`);
    expect(res.status).toBe(200);
    for (const item of res.body.data.items) {
      expect(item.status).toBe('COMPLETED');
    }
  });

  it('lists cancelled appointments', async () => {
    const res = await request(app)
      .get('/api/v1/appointments?tab=cancelled')
      .set('Authorization', `Bearer ${demoToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    expect(res.body.data.items[0].status).toBe('CANCELLED');
  });

  it("lists today's appointments", async () => {
    const res = await request(app)
      .get('/api/v1/appointments?tab=today')
      .set('Authorization', `Bearer ${demoToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });
});

describe('GET /api/v1/appointments/:id', () => {
  it('returns detail for an owned appointment', async () => {
    const listRes = await request(app)
      .get('/api/v1/appointments?tab=upcoming')
      .set('Authorization', `Bearer ${demoToken}`);
    const id = listRes.body.data.items[0].id;

    const res = await request(app)
      .get(`/api/v1/appointments/${id}`)
      .set('Authorization', `Bearer ${demoToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.appointment.id).toBe(id);
    expect(res.body.data.appointment.clinicAddress).toEqual(expect.any(String));
  });

  it('returns 404 for another patient\'s appointment', async () => {
    const { token } = await registerFreshPatient('appt-owner-test@example.com');
    const listRes = await request(app)
      .get('/api/v1/appointments?tab=upcoming')
      .set('Authorization', `Bearer ${demoToken}`);
    const demoAppointmentId = listRes.body.data.items[0].id;

    const res = await request(app)
      .get(`/api/v1/appointments/${demoAppointmentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/v1/appointments/:id/queue', () => {
  it('returns an honest not-active queue state', async () => {
    const listRes = await request(app)
      .get('/api/v1/appointments?tab=today')
      .set('Authorization', `Bearer ${demoToken}`);
    const id = listRes.body.data.items[0].id;

    const res = await request(app)
      .get(`/api/v1/appointments/${id}/queue`)
      .set('Authorization', `Bearer ${demoToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.queue.isActive).toBe(false);
    expect(res.body.data.queue.currentToken).toBeNull();
  });
});

describe('POST /api/v1/appointments/:id/cancel', () => {
  it('cancels a confirmed appointment and creates a notification', async () => {
    const { token, patientId, userId } = await registerFreshPatient('cancel-test@example.com');
    const appointment = await seedAppointmentFor(
      patientId,
      AppointmentStatus.CONFIRMED,
      new Date(Date.now() + 86_400_000),
    );

    const res = await request(app)
      .post(`/api/v1/appointments/${appointment.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Cannot make it' });

    expect(res.status).toBe(200);
    expect(res.body.data.appointment.status).toBe('CANCELLED');

    const notifications = await prisma.notification.findMany({ where: { userId } });
    expect(notifications.some((n) => n.type === 'APPOINTMENT_CANCELLED')).toBe(true);
  });

  it('rejects cancelling an already-completed appointment', async () => {
    const { token, patientId } = await registerFreshPatient('cancel-completed-test@example.com');
    const appointment = await seedAppointmentFor(
      patientId,
      AppointmentStatus.COMPLETED,
      new Date(Date.now() - 86_400_000),
    );

    const res = await request(app)
      .post(`/api/v1/appointments/${appointment.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Change of mind' });

    expect(res.status).toBe(409);
  });
});

describe('Medical records endpoints', () => {
  it('returns medical history', async () => {
    const res = await request(app)
      .get('/api/v1/medical-records/history')
      .set('Authorization', `Bearer ${demoToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.records.length).toBeGreaterThan(0);
  });

  it('returns prescriptions with parsed medications', async () => {
    const res = await request(app)
      .get('/api/v1/medical-records/prescriptions')
      .set('Authorization', `Bearer ${demoToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.prescriptions.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data.prescriptions[0].medications)).toBe(true);
  });

  it('returns lab reports', async () => {
    const res = await request(app)
      .get('/api/v1/medical-records/reports')
      .set('Authorization', `Bearer ${demoToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.reports.length).toBeGreaterThan(0);
  });

  it('returns vaccinations', async () => {
    const res = await request(app)
      .get('/api/v1/medical-records/vaccinations')
      .set('Authorization', `Bearer ${demoToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.vaccinations.length).toBeGreaterThan(0);
  });

  it('returns vitals', async () => {
    const res = await request(app)
      .get('/api/v1/medical-records/vitals')
      .set('Authorization', `Bearer ${demoToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.vitals.length).toBeGreaterThan(0);
  });

  it('returns downloads, excluding records without a file attached', async () => {
    const res = await request(app)
      .get('/api/v1/medical-records/downloads')
      .set('Authorization', `Bearer ${demoToken}`);
    expect(res.status).toBe(200);
    for (const item of res.body.data.downloads) {
      expect(item.fileUrl).toEqual(expect.any(String));
    }
  });
});

describe('Notifications endpoints', () => {
  it('lists, marks one read, marks all read, and updates preferences for a fresh patient', async () => {
    const { token, userId } = await registerFreshPatient('notif-test@example.com');
    await prisma.notification.createMany({
      data: [
        { userId, type: 'APPOINTMENT_UPDATE', title: 'A', message: 'a' },
        { userId, type: 'REPORT_READY', title: 'B', message: 'b' },
      ],
    });

    const listRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.items).toHaveLength(2);

    const unreadRes = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);
    expect(unreadRes.body.data.count).toBe(2);

    const firstId = listRes.body.data.items[0].id;
    const markOneRes = await request(app)
      .patch(`/api/v1/notifications/${firstId}/read`)
      .set('Authorization', `Bearer ${token}`);
    expect(markOneRes.status).toBe(200);

    const markAllRes = await request(app)
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${token}`);
    expect(markAllRes.status).toBe(200);

    const finalUnread = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${token}`);
    expect(finalUnread.body.data.count).toBe(0);

    const prefRes = await request(app)
      .patch('/api/v1/notification-preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        appointmentEmail: false,
        appointmentInApp: true,
        paymentEmail: true,
        paymentInApp: true,
        queueEmail: false,
        queueInApp: true,
        prescriptionEmail: true,
        prescriptionInApp: true,
        announcementEmail: false,
        announcementInApp: true,
      });
    expect(prefRes.status).toBe(200);
    expect(prefRes.body.data.preferences.appointmentEmail).toBe(false);
  });
});

describe('Patient profile endpoints', () => {
  it('returns the demo patient profile with real seeded data', async () => {
    const res = await request(app)
      .get('/api/v1/patient/profile')
      .set('Authorization', `Bearer ${demoToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.profile.fullName).toBe('Ananya Kapoor');
    expect(res.body.data.profile.allergies).toContain('Penicillin');
    expect(res.body.data.profile.addresses.length).toBeGreaterThan(0);
  });

  it('updates profile fields for a fresh patient', async () => {
    const { token } = await registerFreshPatient('profile-update-test@example.com');
    const res = await request(app)
      .patch('/api/v1/patient/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Updated Name',
        allergies: ['Dust'],
        medicalConditions: [],
      });
    expect(res.status).toBe(200);
    expect(res.body.data.profile.fullName).toBe('Updated Name');
    expect(res.body.data.profile.allergies).toEqual(['Dust']);
  });

  it('creates, updates, and deletes an address', async () => {
    const { token } = await registerFreshPatient('address-test@example.com');

    const createRes = await request(app)
      .post('/api/v1/patient/addresses')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'HOME', addressLine1: '1 Test Street', city: 'Pune', isDefault: true });
    expect(createRes.status).toBe(201);
    const addressId = createRes.body.data.address.id;

    const updateRes = await request(app)
      .patch(`/api/v1/patient/addresses/${addressId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'WORK', addressLine1: '2 Test Street', city: 'Pune', isDefault: true });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.address.label).toBe('WORK');

    const deleteRes = await request(app)
      .delete(`/api/v1/patient/addresses/${addressId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(200);
  });

  it('uploads a profile photo', async () => {
    const { token } = await registerFreshPatient('photo-test@example.com');
    const res = await request(app)
      .post('/api/v1/patient/profile/photo')
      .set('Authorization', `Bearer ${token}`)
      .attach('photo', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'avatar.png',
        contentType: 'image/png',
      });
    expect(res.status).toBe(200);
    expect(res.body.data.profileImageUrl).toContain('/uploads/avatars/');
  });

  it('changes email via OTP confirmation', async () => {
    const { token } = await registerFreshPatient('email-change-test@example.com');
    sendEmailMock.mockClear();

    const requestRes = await request(app)
      .post('/api/v1/patient/email/change/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ newEmail: 'new-address@example.com' });
    expect(requestRes.status).toBe(200);

    const call = sendEmailMock.mock.calls.find(([arg]) => arg.to === 'new-address@example.com');
    const code = extractCode(call![0].text);

    const confirmRes = await request(app)
      .post('/api/v1/patient/email/change/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ newEmail: 'new-address@example.com', code });
    expect(confirmRes.status).toBe(200);

    const meRes = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(meRes.body.data.user.email).toBe('new-address@example.com');
  });

  it('rejects changing email to one already in use', async () => {
    const { token } = await registerFreshPatient('email-conflict-test@example.com');
    const res = await request(app)
      .post('/api/v1/patient/email/change/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ newEmail: DEMO_PATIENT_EMAIL });
    expect(res.status).toBe(409);
  });

  it('deletes the account with password confirmation and revokes sessions', async () => {
    const { token } = await registerFreshPatient('delete-account-test@example.com');

    const wrongPasswordRes = await request(app)
      .delete('/api/v1/patient/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'WrongPassword1!' });
    expect(wrongPasswordRes.status).toBe(401);

    const res = await request(app)
      .delete('/api/v1/patient/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'FreshPass123!' });
    expect(res.status).toBe(200);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'delete-account-test@example.com', password: 'FreshPass123!' });
    expect(loginRes.status).toBe(401);
  });
});
