'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SOCKET_EVENTS, type ReceptionQueueSnapshotDto, type TokenPriority } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';
import { useQueueSocket } from '@/hooks/use-queue-socket';
import { getQueueSocket } from '@/lib/socket-client';

function queueKey(clinicId: string | undefined, doctorId: string | undefined) {
  return ['reception', 'queue', clinicId ?? null, doctorId ?? null] as const;
}

export function useReceptionQueue(clinicId: string | undefined, doctorId: string | undefined) {
  return useQuery({
    queryKey: queueKey(clinicId, doctorId),
    queryFn: () => apiFetch<{ queue: ReceptionQueueSnapshotDto }>(`/api/v1/reception/queue?clinicId=${clinicId}&doctorId=${doctorId}`),
    select: (data) => data.queue,
    enabled: Boolean(clinicId && doctorId),
    refetchInterval: 15_000,
  });
}

export function useReceptionQueueLive(clinicId: string | undefined, doctorId: string | undefined) {
  const { isConnected } = useQueueSocket(clinicId);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!clinicId || !doctorId) return;
    const socket = getQueueSocket();
    const invalidate = () => queryClient.invalidateQueries({ queryKey: queueKey(clinicId, doctorId) });

    const events = [
      SOCKET_EVENTS.QUEUE.UPDATED,
      SOCKET_EVENTS.QUEUE.PAUSED,
      SOCKET_EVENTS.QUEUE.RESUMED,
      SOCKET_EVENTS.DOCTOR.QUEUE_UPDATED,
      SOCKET_EVENTS.DOCTOR.STATUS_UPDATED,
      SOCKET_EVENTS.TOKEN.CREATED,
      SOCKET_EVENTS.TOKEN.CALLED,
      SOCKET_EVENTS.TOKEN.REPEATED,
      SOCKET_EVENTS.TOKEN.SKIPPED,
      SOCKET_EVENTS.PATIENT.CHECKED_IN,
      SOCKET_EVENTS.PATIENT.CALLED,
      SOCKET_EVENTS.PATIENT.SKIPPED,
      SOCKET_EVENTS.PATIENT.IN_CONSULTATION,
      SOCKET_EVENTS.PATIENT.COMPLETED,
      SOCKET_EVENTS.CONSULTATION.STARTED,
      SOCKET_EVENTS.CONSULTATION.COMPLETED,
      SOCKET_EVENTS.DELAY.UPDATED,
      SOCKET_EVENTS.APPOINTMENT.UPDATED,
    ];
    events.forEach((event) => socket.on(event, invalidate));
    return () => {
      events.forEach((event) => socket.off(event, invalidate));
    };
  }, [clinicId, doctorId, queryClient]);

  return { isConnected };
}

function useInvalidateQueue(clinicId: string | undefined, doctorId: string | undefined) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queueKey(clinicId, doctorId) });
}

type QueueResult = { queue: ReceptionQueueSnapshotDto };

export function useReceptionCallNext(clinicId: string | undefined, doctorId: string | undefined) {
  const invalidate = useInvalidateQueue(clinicId, doctorId);
  return useMutation({
    mutationFn: () => apiFetch<QueueResult>('/api/v1/reception/queue/call-next', { method: 'POST', body: { clinicId, doctorId } }),
    onSuccess: invalidate,
  });
}

export function useReceptionRepeatCall(clinicId: string | undefined, doctorId: string | undefined) {
  const invalidate = useInvalidateQueue(clinicId, doctorId);
  return useMutation({
    mutationFn: (tokenId: string) =>
      apiFetch<QueueResult>('/api/v1/reception/queue/repeat-call', { method: 'POST', body: { clinicId, doctorId, tokenId } }),
    onSuccess: invalidate,
  });
}

export function useReceptionSkip(clinicId: string | undefined, doctorId: string | undefined) {
  const invalidate = useInvalidateQueue(clinicId, doctorId);
  return useMutation({
    mutationFn: ({ tokenId, reason }: { tokenId: string; reason?: string }) =>
      apiFetch<QueueResult>('/api/v1/reception/queue/skip', { method: 'POST', body: { clinicId, doctorId, tokenId, reason } }),
    onSuccess: invalidate,
  });
}

export function useReceptionPauseQueue(clinicId: string | undefined, doctorId: string | undefined) {
  const invalidate = useInvalidateQueue(clinicId, doctorId);
  return useMutation({
    mutationFn: (reason: string) =>
      apiFetch<QueueResult>('/api/v1/reception/queue/session/pause', { method: 'POST', body: { clinicId, doctorId, reason } }),
    onSuccess: invalidate,
  });
}

export function useReceptionResumeQueue(clinicId: string | undefined, doctorId: string | undefined) {
  const invalidate = useInvalidateQueue(clinicId, doctorId);
  return useMutation({
    mutationFn: () => apiFetch<QueueResult>('/api/v1/reception/queue/session/resume', { method: 'POST', body: { clinicId, doctorId } }),
    onSuccess: invalidate,
  });
}

export function useReceptionUpdateDelay(clinicId: string | undefined, doctorId: string | undefined) {
  const invalidate = useInvalidateQueue(clinicId, doctorId);
  return useMutation({
    mutationFn: ({ delayMinutes, delayReason }: { delayMinutes: number | null; delayReason: string | null }) =>
      apiFetch<QueueResult>('/api/v1/reception/queue/delay', {
        method: 'PATCH',
        body: { clinicId, doctorId, delayMinutes, delayReason },
      }),
    onSuccess: invalidate,
  });
}

export function useReceptionUpdatePriority(clinicId: string | undefined, doctorId: string | undefined) {
  const invalidate = useInvalidateQueue(clinicId, doctorId);
  return useMutation({
    mutationFn: ({ tokenId, priority }: { tokenId: string; priority: TokenPriority }) =>
      apiFetch<QueueResult>('/api/v1/reception/queue/priority', {
        method: 'PATCH',
        body: { clinicId, doctorId, tokenId, priority },
      }),
    onSuccess: invalidate,
  });
}

export function useReceptionMarkInConsultation(clinicId: string | undefined, doctorId: string | undefined) {
  const invalidate = useInvalidateQueue(clinicId, doctorId);
  return useMutation({
    mutationFn: (appointmentId: string) =>
      apiFetch<QueueResult>('/api/v1/reception/queue/mark-in-consultation', { method: 'POST', body: { clinicId, doctorId, appointmentId } }),
    onSuccess: invalidate,
  });
}

export function useReceptionMarkCompleted(clinicId: string | undefined, doctorId: string | undefined) {
  const invalidate = useInvalidateQueue(clinicId, doctorId);
  return useMutation({
    mutationFn: (appointmentId: string) =>
      apiFetch<QueueResult>('/api/v1/reception/queue/mark-completed', { method: 'POST', body: { clinicId, doctorId, appointmentId } }),
    onSuccess: invalidate,
  });
}

export function useReceptionMarkNoShow(clinicId: string | undefined, doctorId: string | undefined) {
  const invalidate = useInvalidateQueue(clinicId, doctorId);
  return useMutation({
    mutationFn: (appointmentId: string) =>
      apiFetch<QueueResult>('/api/v1/reception/queue/no-show', { method: 'POST', body: { clinicId, doctorId, appointmentId } }),
    onSuccess: invalidate,
  });
}
