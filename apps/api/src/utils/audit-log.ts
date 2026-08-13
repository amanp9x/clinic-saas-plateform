import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';

interface RecordAuditLogInput {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  /** Denormalized clinic scope, so "queue history for clinic X" is a direct filtered query
   * instead of a join through entityId. Omit for non-clinic-scoped actions (auth, profile edits). */
  clinicId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
}

/** Fire-and-forget audit trail write. Never throws — a logging failure must not fail the request. */
export function recordAuditLog(input: RecordAuditLogInput): void {
  prisma.auditLog
    .create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        clinicId: input.clinicId,
        metadata: input.metadata,
        ipAddress: input.ipAddress,
      },
    })
    .catch((err: unknown) =>
      logger.error({ err, action: input.action }, 'Failed to write audit log'),
    );
}
