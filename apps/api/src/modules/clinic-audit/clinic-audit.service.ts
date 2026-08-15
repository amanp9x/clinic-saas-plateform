import { CLINIC_PERMISSIONS, type UserRole } from '@clinic/shared';
import type { ClinicAuditLogEventDto, PaginatedResult } from '@clinic/shared';
import { assertClinicPermission } from '../reception/reception.shared.js';
import { prisma } from '../../config/database.js';

function toDto(row: { id: string; action: string; actorUserId: string | null; actorName: string | null; entityType: string; entityId: string | null; metadata: unknown; createdAt: Date }): ClinicAuditLogEventDto {
  return {
    id: row.id,
    action: row.action,
    actorUserId: row.actorUserId,
    actorName: row.actorName,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export const clinicAuditService = {
  async list(
    userId: string,
    role: UserRole,
    clinicId: string,
    filters: { from?: string; to?: string; actorUserId?: string; action?: string; entityType?: string; entityId?: string },
    page: number,
    limit: number,
  ): Promise<PaginatedResult<ClinicAuditLogEventDto>> {
    // Every clinic-management mutation writes its audit row with this clinic's id (see
    // recordAuditLog calls throughout modules/clinic-*) — filtering on it here is what makes
    // cross-clinic audit access structurally impossible, not just permission-gated.
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.CLINIC_VIEW);

    const where = {
      clinicId,
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}),
              ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
      ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
      ...(filters.action ? { action: { contains: filters.action, mode: 'insensitive' as const } } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.auditLog.count({ where }),
    ]);

    const actorIds = [...new Set(rows.map((r) => r.actorUserId).filter((id): id is string => Boolean(id)))];
    const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } } }) : [];
    const nameById = new Map(actors.map((u) => [u.id, u.email ?? u.phone ?? 'Unknown']));

    return {
      items: rows.map((r) => toDto({ ...r, actorName: r.actorUserId ? (nameById.get(r.actorUserId) ?? null) : null })),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  },
};
