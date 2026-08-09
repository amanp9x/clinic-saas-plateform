'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SOCKET_EVENTS, type QueueSnapshotDto } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';
import { useQueueSocket } from '@/hooks/use-queue-socket';
import { getQueueSocket } from '@/lib/socket-client';

function queueKey(clinicId: string | undefined) {
  return ['doctor', 'queue', clinicId ?? null] as const;
}

export function useDoctorQueue(clinicId: string | undefined) {
  return useQuery({
    queryKey: queueKey(clinicId),
    queryFn: () => apiFetch<{ queue: QueueSnapshotDto }>(`/api/v1/doctor/queue?clinicId=${clinicId}`),
    select: (data) => data.queue,
    enabled: Boolean(clinicId),
    refetchInterval: 20_000,
  });
}

/** Subscribes to the clinic's live room and invalidates the queue snapshot on every relevant
 * event, so the console reflects call-next/skip/session changes in real time. */
export function useDoctorQueueLive(clinicId: string | undefined) {
  const { isConnected } = useQueueSocket(clinicId);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!clinicId) return;
    const socket = getQueueSocket();
    const invalidate = () => queryClient.invalidateQueries({ queryKey: queueKey(clinicId) });

    const events = [
      SOCKET_EVENTS.QUEUE.UPDATED,
      SOCKET_EVENTS.DOCTOR.QUEUE_UPDATED,
      SOCKET_EVENTS.DOCTOR.SESSION_STARTED,
      SOCKET_EVENTS.DOCTOR.SESSION_PAUSED,
      SOCKET_EVENTS.DOCTOR.SESSION_RESUMED,
      SOCKET_EVENTS.DOCTOR.STATUS_UPDATED,
      SOCKET_EVENTS.PATIENT.CALLED,
      SOCKET_EVENTS.PATIENT.SKIPPED,
      SOCKET_EVENTS.CONSULTATION.STARTED,
      SOCKET_EVENTS.CONSULTATION.COMPLETED,
      SOCKET_EVENTS.DELAY.UPDATED,
      SOCKET_EVENTS.APPOINTMENT.UPDATED,
    ];
    events.forEach((event) => socket.on(event, invalidate));
    return () => {
      events.forEach((event) => socket.off(event, invalidate));
    };
  }, [clinicId, queryClient]);

  return { isConnected };
}

function useInvalidateQueue(clinicId: string | undefined) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queueKey(clinicId) });
}

export function useStartQueueSession(clinicId: string | undefined) {
  const invalidate = useInvalidateQueue(clinicId);
  return useMutation({
    mutationFn: () => apiFetch<{ queue: QueueSnapshotDto }>('/api/v1/doctor/queue/session/start', { method: 'POST', body: { clinicId } }),
    onSuccess: invalidate,
  });
}

export function usePauseQueueSession(clinicId: string | undefined) {
  const invalidate = useInvalidateQueue(clinicId);
  return useMutation({
    mutationFn: () => apiFetch<{ queue: QueueSnapshotDto }>('/api/v1/doctor/queue/session/pause', { method: 'POST', body: { clinicId } }),
    onSuccess: invalidate,
  });
}

export function useResumeQueueSession(clinicId: string | undefined) {
  const invalidate = useInvalidateQueue(clinicId);
  return useMutation({
    mutationFn: () => apiFetch<{ queue: QueueSnapshotDto }>('/api/v1/doctor/queue/session/resume', { method: 'POST', body: { clinicId } }),
    onSuccess: invalidate,
  });
}

export function useCallNextPatient(clinicId: string | undefined) {
  const invalidate = useInvalidateQueue(clinicId);
  return useMutation({
    mutationFn: () => apiFetch<{ queue: QueueSnapshotDto }>('/api/v1/doctor/queue/call-next', { method: 'POST', body: { clinicId } }),
    onSuccess: invalidate,
  });
}

export function useRepeatCallPatient(clinicId: string | undefined) {
  const invalidate = useInvalidateQueue(clinicId);
  return useMutation({
    mutationFn: (tokenId: string) =>
      apiFetch<{ queue: QueueSnapshotDto }>('/api/v1/doctor/queue/repeat-call', { method: 'POST', body: { clinicId, tokenId } }),
    onSuccess: invalidate,
  });
}

export function useSkipQueuePatient(clinicId: string | undefined) {
  const invalidate = useInvalidateQueue(clinicId);
  return useMutation({
    mutationFn: ({ tokenId, reason }: { tokenId: string; reason?: string }) =>
      apiFetch<{ queue: QueueSnapshotDto }>('/api/v1/doctor/queue/skip', { method: 'POST', body: { clinicId, tokenId, reason } }),
    onSuccess: invalidate,
  });
}

export function useUpdateQueueDelay(clinicId: string | undefined) {
  const invalidate = useInvalidateQueue(clinicId);
  return useMutation({
    mutationFn: ({ delayMinutes, delayReason }: { delayMinutes: number | null; delayReason?: string | null }) =>
      apiFetch<{ queue: QueueSnapshotDto }>('/api/v1/doctor/queue/delay', {
        method: 'PATCH',
        body: { clinicId, delayMinutes, delayReason },
      }),
    onSuccess: invalidate,
  });
}
