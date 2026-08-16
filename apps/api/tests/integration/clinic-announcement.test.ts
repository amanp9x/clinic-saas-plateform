import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { CLINIC_PERMISSIONS } from '@clinic/shared';

const { createApp } = await import('../../src/app.js');
const {
  createDoctorFixture,
  createPatientFixture,
  createDoctorAvailabilityFixture,
  createClinicWorkingHoursFixture,
  tomorrowInfo,
  atTime,
} = await import('../helpers/doctor-fixtures.js');
const { createReceptionFixture } = await import('../helpers/reception-fixtures.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

describe('POST /api/v1/clinic/announcements', () => {
  it('rejects staff without the announce permission', async () => {
    const fixture = await createDoctorFixture(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, []);
    const res = await request(app)
      .post('/api/v1/clinic/announcements')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ clinicId: fixture.clinicId, title: 'Test', message: 'Test message', audience: 'STAFF' });
    expect(res.status).toBe(403);
  });

  it('rejects a doctor (no clinic-staff role) and rejects staff acting on a foreign clinic', async () => {
    const fixture = await createDoctorFixture(app);
    const asDoctor = await request(app)
      .post('/api/v1/clinic/announcements')
      .set('Authorization', `Bearer ${fixture.token}`)
      .send({ clinicId: fixture.clinicId, title: 'Test', message: 'Test message', audience: 'STAFF' });
    expect(asDoctor.status).toBe(403);

    const otherClinic = await createDoctorFixture(app);
    const foreignStaff = await createReceptionFixture(app, otherClinic.clinicId, [CLINIC_PERMISSIONS.NOTIFICATION_ANNOUNCE]);
    const res = await request(app)
      .post('/api/v1/clinic/announcements')
      .set('Authorization', `Bearer ${foreignStaff.token}`)
      .send({ clinicId: fixture.clinicId, title: 'Test', message: 'Test message', audience: 'STAFF' });
    expect(res.status).toBe(403);
  });

  it('notifies active clinic patients without ever returning a patient list to the caller', async () => {
    const fixture = await createDoctorFixture(app);
    const { weekday, dateObj } = tomorrowInfo();
    await createClinicWorkingHoursFixture(fixture.clinicId, { weekday, sessions: [{ startTime: '09:00', endTime: '13:00' }] });
    await createDoctorAvailabilityFixture(fixture.clinicDoctorId, { weekday, startTime: '09:00', endTime: '13:00', consultationDurationMinutes: 15 });
    const slot = atTime(dateObj, '09:00');

    const patient = await createPatientFixture(app);
    await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${patient.token}`)
      .send({ doctorId: fixture.doctorId, clinicId: fixture.clinicId, scheduledAt: slot.toISOString(), consultationType: 'IN_CLINIC', appointmentType: 'NEW_CONSULTATION' });

    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.NOTIFICATION_ANNOUNCE]);
    const res = await request(app)
      .post('/api/v1/clinic/announcements')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ clinicId: fixture.clinicId, title: 'Clinic closed tomorrow', message: 'We will be closed for maintenance.', audience: 'PATIENTS' });
    expect(res.status).toBe(201);
    expect(res.body.data.recipientCount).toBeGreaterThanOrEqual(1);
    // No patient identifying data anywhere in the response — only a count.
    expect(JSON.stringify(res.body.data)).not.toMatch(/@|fullName|phone/i);

    const notif = await prisma.notification.findFirst({ where: { userId: patient.userId, type: 'CLINIC_ANNOUNCEMENT' } });
    expect(notif).not.toBeNull();
    expect(notif!.title).toBe('Clinic closed tomorrow');
  });

  it('does not notify a patient with no active appointment at this clinic', async () => {
    const fixture = await createDoctorFixture(app);
    const unrelatedPatient = await createPatientFixture(app);
    const staff = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.NOTIFICATION_ANNOUNCE]);

    await request(app)
      .post('/api/v1/clinic/announcements')
      .set('Authorization', `Bearer ${staff.token}`)
      .send({ clinicId: fixture.clinicId, title: 'Announcement', message: 'Message', audience: 'PATIENTS' });

    const notif = await prisma.notification.findFirst({ where: { userId: unrelatedPatient.userId, type: 'CLINIC_ANNOUNCEMENT' } });
    expect(notif).toBeNull();
  });

  it('notifies active clinic staff for the STAFF audience', async () => {
    const fixture = await createDoctorFixture(app);
    const announcer = await createReceptionFixture(app, fixture.clinicId, [CLINIC_PERMISSIONS.NOTIFICATION_ANNOUNCE]);
    const otherStaff = await createReceptionFixture(app, fixture.clinicId, []);

    await request(app)
      .post('/api/v1/clinic/announcements')
      .set('Authorization', `Bearer ${announcer.token}`)
      .send({ clinicId: fixture.clinicId, title: 'Staff meeting', message: 'Meeting at 5pm', audience: 'STAFF' });

    const notifOther = await prisma.notification.findFirst({ where: { userId: otherStaff.userId, type: 'CLINIC_ANNOUNCEMENT' } });
    expect(notifOther).not.toBeNull();
  });
});
