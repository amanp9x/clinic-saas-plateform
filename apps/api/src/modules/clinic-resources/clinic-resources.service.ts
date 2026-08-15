import { CLINIC_PERMISSIONS, SOCKET_EVENTS, type UserRole } from '@clinic/shared';
import type { ClinicResourceDto, ResourceCreateInput, ResourceUpdateInput } from '@clinic/shared';
import type { ClinicResource } from '@prisma/client';
import { assertClinicPermission } from '../reception/reception.shared.js';
import { prisma } from '../../config/database.js';
import { NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom } from '../../sockets/emit.js';

function toDto(r: ClinicResource): ClinicResourceDto {
  return {
    id: r.id,
    clinicId: r.clinicId,
    name: r.name,
    type: r.type,
    code: r.code,
    floor: r.floor,
    capacity: r.capacity,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  };
}

async function requireResource(id: string, clinicId: string) {
  const resource = await prisma.clinicResource.findFirst({ where: { id, clinicId } });
  if (!resource) throw new NotFoundError('Resource');
  return resource;
}

export const clinicResourcesService = {
  async list(userId: string, role: UserRole, clinicId: string): Promise<ClinicResourceDto[]> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.RESOURCE_VIEW);
    const resources = await prisma.clinicResource.findMany({ where: { clinicId }, orderBy: { name: 'asc' } });
    return resources.map(toDto);
  },

  async create(userId: string, role: UserRole, clinicId: string, input: Omit<ResourceCreateInput, 'clinicId'>): Promise<ClinicResourceDto> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.RESOURCE_MANAGE);

    const created = await prisma.clinicResource.create({
      data: { clinicId, name: input.name, type: input.type, code: input.code, floor: input.floor, capacity: input.capacity },
    });

    recordAuditLog({ actorUserId: userId, action: 'clinic.resource_created', entityType: 'ClinicResource', entityId: created.id, clinicId, metadata: { name: input.name, type: input.type } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.CLINIC.UPDATED, { clinicId });
    return toDto(created);
  },

  async update(userId: string, role: UserRole, clinicId: string, id: string, input: ResourceUpdateInput): Promise<ClinicResourceDto> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.RESOURCE_MANAGE);
    await requireResource(id, clinicId);

    const updated = await prisma.clinicResource.update({ where: { id }, data: input });

    recordAuditLog({ actorUserId: userId, action: 'clinic.resource_updated', entityType: 'ClinicResource', entityId: id, clinicId, metadata: { fields: Object.keys(input) } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.CLINIC.UPDATED, { clinicId });
    return toDto(updated);
  },

  async remove(userId: string, role: UserRole, clinicId: string, id: string): Promise<void> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.RESOURCE_MANAGE);
    const resource = await requireResource(id, clinicId);

    await prisma.clinicResource.delete({ where: { id } });
    recordAuditLog({ actorUserId: userId, action: 'clinic.resource_deleted', entityType: 'ClinicResource', entityId: id, clinicId, metadata: { name: resource.name } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.CLINIC.UPDATED, { clinicId });
  },
};
