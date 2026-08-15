import { CLINIC_PERMISSIONS, SOCKET_EVENTS, type UserRole } from '@clinic/shared';
import type { ClinicHolidayDto, HolidayCreateInput } from '@clinic/shared';
import type { ClinicHoliday } from '@prisma/client';
import { assertClinicPermission } from '../reception/reception.shared.js';
import { prisma } from '../../config/database.js';
import { ConflictError, NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom } from '../../sockets/emit.js';

function toTimeString(date: Date | null): string | null {
  return date ? date.toISOString().slice(11, 16) : null;
}

function toDto(h: ClinicHoliday): ClinicHolidayDto {
  return {
    id: h.id,
    clinicId: h.clinicId,
    date: h.date.toISOString().slice(0, 10),
    name: h.name,
    description: h.description,
    isFullDay: h.isFullDay,
    startTime: toTimeString(h.startTime),
    endTime: toTimeString(h.endTime),
  };
}

export const clinicHolidaysService = {
  async list(userId: string, role: UserRole, clinicId: string): Promise<ClinicHolidayDto[]> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.HOLIDAY_VIEW);
    const holidays = await prisma.clinicHoliday.findMany({ where: { clinicId }, orderBy: { date: 'asc' } });
    return holidays.map(toDto);
  },

  async create(userId: string, role: UserRole, clinicId: string, input: Omit<HolidayCreateInput, 'clinicId'>): Promise<ClinicHolidayDto> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.HOLIDAY_MANAGE);

    const date = new Date(`${input.date}T00:00:00.000Z`);
    const existing = await prisma.clinicHoliday.findUnique({ where: { clinicId_date: { clinicId, date } } });
    if (existing) throw new ConflictError('A holiday is already recorded for this date');

    const created = await prisma.clinicHoliday.create({
      data: {
        clinicId,
        date,
        name: input.name,
        description: input.description,
        isFullDay: input.isFullDay,
        startTime: input.startTime ? new Date(`1970-01-01T${input.startTime}:00.000Z`) : null,
        endTime: input.endTime ? new Date(`1970-01-01T${input.endTime}:00.000Z`) : null,
      },
    });

    recordAuditLog({ actorUserId: userId, action: 'clinic.holiday_created', entityType: 'ClinicHoliday', entityId: created.id, clinicId, metadata: { date: input.date, name: input.name } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.CLINIC.SCHEDULE_UPDATED, { clinicId });
    return toDto(created);
  },

  async remove(userId: string, role: UserRole, clinicId: string, id: string): Promise<void> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.HOLIDAY_MANAGE);
    const holiday = await prisma.clinicHoliday.findFirst({ where: { id, clinicId } });
    if (!holiday) throw new NotFoundError('Holiday');

    await prisma.clinicHoliday.delete({ where: { id } });
    recordAuditLog({ actorUserId: userId, action: 'clinic.holiday_deleted', entityType: 'ClinicHoliday', entityId: id, clinicId, metadata: { name: holiday.name } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.CLINIC.SCHEDULE_UPDATED, { clinicId });
  },
};
