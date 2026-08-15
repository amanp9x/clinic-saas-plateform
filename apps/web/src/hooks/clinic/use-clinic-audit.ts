'use client';

import { useQuery } from '@tanstack/react-query';
import type { ClinicAuditLogEventDto, PaginatedResult } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

export interface ClinicAuditFilters {
  from?: string;
  to?: string;
  action?: string;
  entityType?: string;
  actorUserId?: string;
}

export function useClinicAuditLog(clinicId: string | undefined, filters: ClinicAuditFilters) {
  const params = new URLSearchParams();
  if (clinicId) params.set('clinicId', clinicId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.action) params.set('action', filters.action);
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.actorUserId) params.set('actorUserId', filters.actorUserId);

  return useQuery({
    queryKey: ['clinic', 'audit-logs', clinicId ?? null, filters] as const,
    queryFn: () => apiFetch<{ auditLog: PaginatedResult<ClinicAuditLogEventDto> }>(`/api/v1/clinic/audit-logs?${params.toString()}`),
    select: (data) => data.auditLog,
    enabled: Boolean(clinicId),
  });
}
