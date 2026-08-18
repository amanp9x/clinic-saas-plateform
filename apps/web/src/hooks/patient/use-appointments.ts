'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AppointmentDetailDto,
  AppointmentSummaryDto,
  AppointmentTab,
  CancelAppointmentInput,
  PaginatedResult,
  QueueViewDto,
  VisitSummaryDto,
} from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const APPOINTMENTS_KEY = ['patient', 'appointments'] as const;

export function useAppointments(tab: AppointmentTab, page = 1) {
  return useQuery({
    queryKey: [...APPOINTMENTS_KEY, tab, page],
    queryFn: () =>
      apiFetch<PaginatedResult<AppointmentSummaryDto>>(
        `/api/v1/appointments?tab=${tab}&page=${page}&limit=10`,
      ),
  });
}

export function useAppointment(id: string) {
  return useQuery({
    queryKey: [...APPOINTMENTS_KEY, id],
    queryFn: () => apiFetch<{ appointment: AppointmentDetailDto }>(`/api/v1/appointments/${id}`),
    select: (data) => data.appointment,
    enabled: Boolean(id),
  });
}

export function useCancelAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: CancelAppointmentInput & { id: string }) =>
      apiFetch<{ appointment: AppointmentDetailDto }>(`/api/v1/appointments/${id}/cancel`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ['patient', 'dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['patient', 'notifications'] });
    },
  });
}

export function useVisitSummary(appointmentId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...APPOINTMENTS_KEY, appointmentId, 'visit-summary'],
    queryFn: () => apiFetch<{ summary: VisitSummaryDto }>(`/api/v1/appointments/${appointmentId}/visit-summary`),
    select: (data) => data.summary,
    enabled: Boolean(appointmentId) && enabled,
  });
}

export function useQueueView(appointmentId: string | undefined) {
  return useQuery({
    queryKey: ['patient', 'queue', appointmentId],
    queryFn: () => apiFetch<{ queue: QueueViewDto }>(`/api/v1/appointments/${appointmentId}/queue`),
    select: (data) => data.queue,
    enabled: Boolean(appointmentId),
    refetchOnWindowFocus: false,
  });
}
