import { CLINIC_PERMISSIONS, SOCKET_EVENTS, type UserRole } from '@clinic/shared';
import type { DepartmentCreateInput, DepartmentDto, DepartmentUpdateInput } from '@clinic/shared';
import { assertClinicPermission } from '../reception/reception.shared.js';
import { prisma } from '../../config/database.js';
import { ConflictError, NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom } from '../../sockets/emit.js';

function toDto(d: { id: string; clinicId: string; name: string; description: string | null; isActive: boolean; displayOrder: number; createdAt: Date; _count: { clinicDoctors: number; services: number } }): DepartmentDto {
  return {
    id: d.id,
    clinicId: d.clinicId,
    name: d.name,
    description: d.description,
    isActive: d.isActive,
    displayOrder: d.displayOrder,
    doctorCount: d._count.clinicDoctors,
    serviceCount: d._count.services,
    createdAt: d.createdAt.toISOString(),
  };
}

async function requireDepartment(id: string, clinicId: string) {
  const dept = await prisma.department.findFirst({ where: { id, clinicId }, include: { _count: { select: { clinicDoctors: true, services: true } } } });
  if (!dept) throw new NotFoundError('Department');
  return dept;
}

export const clinicDepartmentsService = {
  async list(userId: string, role: UserRole, clinicId: string, q: string | undefined): Promise<DepartmentDto[]> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.DEPARTMENT_VIEW);
    const departments = await prisma.department.findMany({
      where: { clinicId, ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) },
      include: { _count: { select: { clinicDoctors: true, services: true } } },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    return departments.map(toDto);
  },

  async create(userId: string, role: UserRole, clinicId: string, input: DepartmentCreateInput): Promise<DepartmentDto> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.DEPARTMENT_MANAGE);

    const existing = await prisma.department.findUnique({ where: { clinicId_name: { clinicId, name: input.name } } });
    if (existing) throw new ConflictError('A department with this name already exists at this clinic');

    const created = await prisma.department.create({
      data: { clinicId, name: input.name, description: input.description, displayOrder: input.displayOrder },
      include: { _count: { select: { clinicDoctors: true, services: true } } },
    });

    recordAuditLog({ actorUserId: userId, action: 'clinic.department_created', entityType: 'Department', entityId: created.id, clinicId, metadata: { name: input.name } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.CLINIC.UPDATED, { clinicId });
    return toDto(created);
  },

  async update(userId: string, role: UserRole, clinicId: string, id: string, input: DepartmentUpdateInput): Promise<DepartmentDto> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.DEPARTMENT_MANAGE);
    await requireDepartment(id, clinicId);

    if (input.name) {
      const existing = await prisma.department.findUnique({ where: { clinicId_name: { clinicId, name: input.name } } });
      if (existing && existing.id !== id) throw new ConflictError('A department with this name already exists at this clinic');
    }

    const updated = await prisma.department.update({
      where: { id },
      data: input,
      include: { _count: { select: { clinicDoctors: true, services: true } } },
    });

    recordAuditLog({ actorUserId: userId, action: 'clinic.department_updated', entityType: 'Department', entityId: id, clinicId, metadata: { fields: Object.keys(input) } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.CLINIC.UPDATED, { clinicId });
    return toDto(updated);
  },

  async remove(userId: string, role: UserRole, clinicId: string, id: string): Promise<void> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.DEPARTMENT_MANAGE);
    const dept = await requireDepartment(id, clinicId);

    if (dept._count.clinicDoctors > 0 || dept._count.services > 0) {
      throw new ConflictError('Cannot delete a department that still has doctors or services assigned — deactivate it instead');
    }

    await prisma.department.delete({ where: { id } });
    recordAuditLog({ actorUserId: userId, action: 'clinic.department_deleted', entityType: 'Department', entityId: id, clinicId, metadata: { name: dept.name } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.CLINIC.UPDATED, { clinicId });
  },
};
