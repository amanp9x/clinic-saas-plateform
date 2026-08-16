import { describe, expect, it } from 'vitest';

const { createApp } = await import('../../src/app.js');
const { createDoctorFixture, createPatientFixture, createAppointmentFixture } = await import('../helpers/doctor-fixtures.js');
const { processDueReminders } = await import('../../src/modules/notifications/reminder.service.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

describe('Appointment reminder scheduler', () => {
  it('sends a 24h reminder for an appointment just inside the window, and never sends it twice', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const scheduledAt = new Date(Date.now() + 23.9 * 60 * 60_000); // just inside the 24h lookahead
    const appointment = await createAppointmentFixture({ patientId: patient.patientId, doctorId: fixture.doctorId, clinicId: fixture.clinicId, status: 'CONFIRMED', scheduledAt });

    const first = await processDueReminders();
    expect(first.processed).toBeGreaterThanOrEqual(1);

    const notif = await prisma.notification.findUnique({ where: { notificationKey: `reminder:${appointment.id}:24h` } });
    expect(notif).not.toBeNull();
    expect(notif!.type).toBe('APPOINTMENT_REMINDER');
    expect(notif!.userId).toBe(patient.userId);

    const countBefore = await prisma.notification.count({ where: { notificationKey: `reminder:${appointment.id}:24h` } });
    await processDueReminders();
    await processDueReminders();
    const countAfter = await prisma.notification.count({ where: { notificationKey: `reminder:${appointment.id}:24h` } });
    expect(countAfter).toBe(countBefore); // idempotent across repeated ticks
  });

  it('does not send a reminder for an appointment far outside any window, or a cancelled one', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    const farAppointment = await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: fixture.doctorId,
      clinicId: fixture.clinicId,
      status: 'CONFIRMED',
      scheduledAt: new Date(Date.now() + 72 * 60 * 60_000),
    });
    const cancelledAppointment = await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: fixture.doctorId,
      clinicId: fixture.clinicId,
      status: 'CANCELLED',
      scheduledAt: new Date(Date.now() + 1 * 60 * 60_000),
    });

    await processDueReminders();

    const farNotif = await prisma.notification.findUnique({ where: { notificationKey: `reminder:${farAppointment.id}:24h` } });
    expect(farNotif).toBeNull();
    const cancelledNotif = await prisma.notification.findFirst({ where: { relatedEntityId: cancelledAppointment.id, type: 'APPOINTMENT_STARTING_SOON' } });
    expect(cancelledNotif).toBeNull();
  });

  it('honors the clinic-configured reminderMinutesBefore for the "starting soon" tier', async () => {
    const fixture = await createDoctorFixture(app);
    const patient = await createPatientFixture(app);
    await prisma.clinicSettings.upsert({
      where: { clinicId: fixture.clinicId },
      create: { clinicId: fixture.clinicId, reminderMinutesBefore: 30 },
      update: { reminderMinutesBefore: 30 },
    });
    const appointment = await createAppointmentFixture({
      patientId: patient.patientId,
      doctorId: fixture.doctorId,
      clinicId: fixture.clinicId,
      status: 'CONFIRMED',
      scheduledAt: new Date(Date.now() + 25 * 60_000), // 25 min out — inside the 30-min configured window
    });

    await processDueReminders();

    const notif = await prisma.notification.findUnique({ where: { notificationKey: `reminder:${appointment.id}:soon-30m` } });
    expect(notif).not.toBeNull();
    expect(notif!.type).toBe('APPOINTMENT_STARTING_SOON');
  });
});
