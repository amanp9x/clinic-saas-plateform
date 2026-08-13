'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SOCKET_EVENTS, type ReceptionDashboardSummaryDto } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';
import { useQueueSocket } from '@/hooks/use-queue-socket';
import { getQueueSocket } from '@/lib/socket-client';

function dashboardKey(clinicId: string | undefined) {
  return ['reception', 'dashboard', clinicId ?? null] as const;
}

export function useReceptionDashboard(clinicId: string | undefined) {
  return useQuery({
    queryKey: dashboardKey(clinicId),
    queryFn: () => apiFetch<{ summary: ReceptionDashboardSummaryDto }>(`/api/v1/reception/dashboard?clinicId=${clinicId}`),
    select: (data) => data.summary,
    enabled: Boolean(clinicId),
    refetchInterval: 20_000,
  });
}

/** Keeps the dashboard's per-doctor queue cards live without polling faster than 20s. */
export function useReceptionDashboardLive(clinicId: string | undefined) {
  const { isConnected } = useQueueSocket(clinicId);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!clinicId) return;
    const socket = getQueueSocket();
    const invalidate = () => queryClient.invalidateQueries({ queryKey: dashboardKey(clinicId) });

    const events = [
      SOCKET_EVENTS.QUEUE.UPDATED,
      SOCKET_EVENTS.DOCTOR.STATUS_UPDATED,
      SOCKET_EVENTS.DOCTOR.SESSION_STARTED,
      SOCKET_EVENTS.DOCTOR.SESSION_PAUSED,
      SOCKET_EVENTS.DOCTOR.SESSION_RESUMED,
      SOCKET_EVENTS.PATIENT.CHECKED_IN,
      SOCKET_EVENTS.CONSULTATION.STARTED,
      SOCKET_EVENTS.CONSULTATION.COMPLETED,
      SOCKET_EVENTS.DELAY.UPDATED,
    ];
    events.forEach((event) => socket.on(event, invalidate));
    return () => {
      events.forEach((event) => socket.off(event, invalidate));
    };
  }, [clinicId, queryClient]);

  return { isConnected };
}
