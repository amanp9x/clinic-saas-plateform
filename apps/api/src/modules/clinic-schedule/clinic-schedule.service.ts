import { CLINIC_PERMISSIONS, SOCKET_EVENTS, Weekday, type UserRole } from '@clinic/shared';
import type { ClinicWorkingHoursDto, WorkingHoursUpdateInput } from '@clinic/shared';
import { assertClinicPermission } from '../reception/reception.shared.js';
import { prisma } from '../../config/database.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom } from '../../sockets/emit.js';

const ALL_WEEKDAYS = Object.values(Weekday);

function toTimeString(date: Date): string {
  return date.toISOString().slice(11, 16);
}

function toTimeDate(value: string): Date {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

export const clinicScheduleService = {
  async list(userId: string, role: UserRole, clinicId: string): Promise<ClinicWorkingHoursDto[]> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.SCHEDULE_VIEW);
    const rows = await prisma.clinicWorkingHours.findMany({ where: { clinicId }, include: { sessions: true } });
    const byWeekday = new Map(rows.map((r) => [r.weekday, r]));

    return ALL_WEEKDAYS.map((weekday) => {
      const row = byWeekday.get(weekday);
      if (!row) {
        return { id: '', weekday, isOpen: false, sessions: [] };
      }
      return {
        id: row.id,
        weekday: row.weekday,
        isOpen: row.isOpen,
        sessions: row.sessions.map((s) => ({ id: s.id, startTime: toTimeString(s.startTime), endTime: toTimeString(s.endTime) })),
      };
    });
  },

  async upsert(userId: string, role: UserRole, clinicId: string, input: WorkingHoursUpdateInput): Promise<ClinicWorkingHoursDto> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.SCHEDULE_MANAGE);

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.clinicWorkingHours.upsert({
        where: { clinicId_weekday: { clinicId, weekday: input.weekday } },
        update: { isOpen: input.isOpen },
        create: { clinicId, weekday: input.weekday, isOpen: input.isOpen },
      });
      await tx.clinicWorkingHoursSession.deleteMany({ where: { workingHoursId: row.id } });
      if (input.sessions.length > 0) {
        await tx.clinicWorkingHoursSession.createMany({
          data: input.sessions.map((s) => ({ workingHoursId: row.id, startTime: toTimeDate(s.startTime), endTime: toTimeDate(s.endTime) })),
        });
      }
      return tx.clinicWorkingHours.findUniqueOrThrow({ where: { id: row.id }, include: { sessions: true } });
    });

    recordAuditLog({
      actorUserId: userId,
      action: 'clinic.schedule_updated',
      entityType: 'ClinicWorkingHours',
      entityId: updated.id,
      clinicId,
      metadata: { weekday: input.weekday, isOpen: input.isOpen, sessionCount: input.sessions.length },
    });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.CLINIC.SCHEDULE_UPDATED, { clinicId, weekday: input.weekday });

    return {
      id: updated.id,
      weekday: updated.weekday,
      isOpen: updated.isOpen,
      sessions: updated.sessions.map((s) => ({ id: s.id, startTime: toTimeString(s.startTime), endTime: toTimeString(s.endTime) })),
    };
  },
};
