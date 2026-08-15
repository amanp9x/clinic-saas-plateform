import { CLINIC_PERMISSIONS, SOCKET_EVENTS, type UserRole } from '@clinic/shared';
import type { ClinicServiceDto, ServiceCreateInput, ServiceUpdateInput } from '@clinic/shared';
import type { ClinicService, Department } from '@prisma/client';
import { assertClinicPermission } from '../reception/reception.shared.js';
import { prisma } from '../../config/database.js';
import { ConflictError, NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom } from '../../sockets/emit.js';

function toDto(s: ClinicService & { department: Department | null }): ClinicServiceDto {
  return {
    id: s.id,
    clinicId: s.clinicId,
    departmentId: s.departmentId,
    departmentName: s.department?.name ?? null,
    name: s.name,
    description: s.description,
    durationMinutes: s.durationMinutes,
    price: s.price.toString(),
    taxApplicable: s.taxApplicable,
    isActive: s.isActive,
    createdAt: s.createdAt.toISOString(),
  };
}

async function requireService(id: string, clinicId: string) {
  const service = await prisma.clinicService.findFirst({ where: { id, clinicId }, include: { department: true } });
  if (!service) throw new NotFoundError('Service');
  return service;
}

export const clinicServicesService = {
  async list(userId: string, role: UserRole, clinicId: string, q: string | undefined): Promise<ClinicServiceDto[]> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.SERVICE_VIEW);
    const services = await prisma.clinicService.findMany({
      where: { clinicId, ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) },
      include: { department: true },
      orderBy: { name: 'asc' },
    });
    return services.map(toDto);
  },

  async create(userId: string, role: UserRole, clinicId: string, input: ServiceCreateInput): Promise<ClinicServiceDto> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.SERVICE_MANAGE);

    const existing = await prisma.clinicService.findUnique({ where: { clinicId_name: { clinicId, name: input.name } } });
    if (existing) throw new ConflictError('A service with this name already exists at this clinic');

    const created = await prisma.clinicService.create({
      data: {
        clinicId,
        name: input.name,
        description: input.description,
        departmentId: input.departmentId ?? undefined,
        durationMinutes: input.durationMinutes,
        price: input.price,
        taxApplicable: input.taxApplicable,
      },
      include: { department: true },
    });

    recordAuditLog({ actorUserId: userId, action: 'clinic.service_created', entityType: 'ClinicService', entityId: created.id, clinicId, metadata: { name: input.name } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.CLINIC.UPDATED, { clinicId });
    return toDto(created);
  },

  async update(userId: string, role: UserRole, clinicId: string, id: string, input: ServiceUpdateInput): Promise<ClinicServiceDto> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.SERVICE_MANAGE);
    await requireService(id, clinicId);

    if (input.name) {
      const existing = await prisma.clinicService.findUnique({ where: { clinicId_name: { clinicId, name: input.name } } });
      if (existing && existing.id !== id) throw new ConflictError('A service with this name already exists at this clinic');
    }

    const updated = await prisma.clinicService.update({
      where: { id },
      data: { ...input, departmentId: input.departmentId },
      include: { department: true },
    });

    recordAuditLog({ actorUserId: userId, action: 'clinic.service_updated', entityType: 'ClinicService', entityId: id, clinicId, metadata: { fields: Object.keys(input) } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.CLINIC.UPDATED, { clinicId });
    return toDto(updated);
  },

  async remove(userId: string, role: UserRole, clinicId: string, id: string): Promise<void> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.SERVICE_MANAGE);
    const service = await requireService(id, clinicId);

    await prisma.clinicService.delete({ where: { id } });
    recordAuditLog({ actorUserId: userId, action: 'clinic.service_deleted', entityType: 'ClinicService', entityId: id, clinicId, metadata: { name: service.name } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.CLINIC.UPDATED, { clinicId });
  },
};
