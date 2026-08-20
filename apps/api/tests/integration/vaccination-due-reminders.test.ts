import { describe, expect, it } from 'vitest';

const { createApp } = await import('../../src/app.js');
const { createPatientFixture } = await import('../helpers/doctor-fixtures.js');
const { processDueVaccinationReminders } = await import('../../src/modules/notifications/reminder.service.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

async function createVaccinationDue(patientId: string, nextDueDate: Date | null) {
  return prisma.vaccination.create({
    data: {
      patientId,
      vaccineName: 'Tetanus Toxoid',
      doseNumber: 2,
      administeredDate: new Date(Date.now() - 365 * 24 * 60 * 60_000),
      nextDueDate,
    },
  });
}

describe('Vaccination due reminder scheduler', () => {
  it('sends a 7-day-tier reminder for a vaccination due in 5 days, and never sends it twice', async () => {
    const patient = await createPatientFixture(app);
    const vaccination = await createVaccinationDue(patient.patientId, new Date(Date.now() + 5 * 24 * 60 * 60_000));

    const first = await processDueVaccinationReminders();
    expect(first.processed).toBeGreaterThanOrEqual(1);

    const notif = await prisma.notification.findUnique({ where: { notificationKey: `vaccination:${vaccination.id}:7d` } });
    expect(notif).not.toBeNull();
    expect(notif!.type).toBe('VACCINATION_DUE');
    expect(notif!.userId).toBe(patient.userId);

    await processDueVaccinationReminders();
    const count = await prisma.notification.count({ where: { notificationKey: `vaccination:${vaccination.id}:7d` } });
    expect(count).toBe(1);
  });

  it('does not fire the overdue tier for a vaccination that is due but not yet passed', async () => {
    const patient = await createPatientFixture(app);
    const vaccination = await createVaccinationDue(patient.patientId, new Date(Date.now() + 2 * 24 * 60 * 60_000));
    await processDueVaccinationReminders();

    const overdueNotif = await prisma.notification.findUnique({ where: { notificationKey: `vaccination:${vaccination.id}:overdue` } });
    expect(overdueNotif).toBeNull();
  });

  it('sends the overdue-tier reminder for a vaccination whose due date has already passed', async () => {
    const patient = await createPatientFixture(app);
    const vaccination = await createVaccinationDue(patient.patientId, new Date(Date.now() - 3 * 24 * 60 * 60_000));
    await processDueVaccinationReminders();

    const overdueNotif = await prisma.notification.findUnique({ where: { notificationKey: `vaccination:${vaccination.id}:overdue` } });
    expect(overdueNotif).not.toBeNull();
    expect(overdueNotif!.title).toContain('overdue');
  });

  it('does not fire for a vaccination due in 30 days (outside the 7-day window)', async () => {
    const patient = await createPatientFixture(app);
    const vaccination = await createVaccinationDue(patient.patientId, new Date(Date.now() + 30 * 24 * 60 * 60_000));
    await processDueVaccinationReminders();

    const count = await prisma.notification.count({ where: { relatedEntityType: 'Vaccination', relatedEntityId: vaccination.id } });
    expect(count).toBe(0);
  });

  it('does not fire for a vaccination with no next due date', async () => {
    const patient = await createPatientFixture(app);
    const vaccination = await createVaccinationDue(patient.patientId, null);
    await processDueVaccinationReminders();

    const count = await prisma.notification.count({ where: { relatedEntityType: 'Vaccination', relatedEntityId: vaccination.id } });
    expect(count).toBe(0);
  });
});

describe('MANDATORY: simultaneous reminder-scheduler ticks never double-notify', () => {
  it('two concurrent processDueVaccinationReminders calls for the same due vaccination produce exactly one notification', async () => {
    const patient = await createPatientFixture(app);
    const vaccination = await createVaccinationDue(patient.patientId, new Date(Date.now() + 3 * 24 * 60 * 60_000));

    await Promise.all([processDueVaccinationReminders(), processDueVaccinationReminders()]);

    const count = await prisma.notification.count({ where: { notificationKey: `vaccination:${vaccination.id}:7d` } });
    expect(count).toBe(1);
  });
});
