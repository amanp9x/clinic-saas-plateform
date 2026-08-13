'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  PaginatedResult,
  ReceptionAppointmentSummaryDto,
  ReceptionAppointmentTab,
  WalkInCreateInput,
} from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const APPOINTMENTS_KEY = ['reception', 'appointments'] as const;

export function useReceptionAppointments(clinicId: string | undefined, tab: ReceptionAppointmentTab, doctorId?: string) {
  return useQuery({
    queryKey: [...APPOINTMENTS_KEY, clinicId ?? null, tab, doctorId ?? null],
    queryFn: () =>
      apiFetch<{ appointments: PaginatedResult<ReceptionAppointmentSummaryDto> }>(
        `/api/v1/reception/appointments?clinicId=${clinicId}&tab=${tab}${doctorId ? `&doctorId=${doctorId}` : ''}&limit=100`,
      ),
    select: (data) => data.appointments,
    enabled: Boolean(clinicId),
    refetchInterval: 20_000,
  });
}

export function useReceptionCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: string) =>
      apiFetch<{ token: unknown }>('/api/v1/reception/checkin', { method: 'POST', body: { appointmentId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ['reception', 'queue'] });
      queryClient.invalidateQueries({ queryKey: ['reception', 'dashboard'] });
    },
  });
}

export function useReceptionWalkIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WalkInCreateInput) =>
      apiFetch<{ appointmentId: string; token: unknown }>('/api/v1/reception/walkin', { method: 'POST', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ['reception', 'queue'] });
      queryClient.invalidateQueries({ queryKey: ['reception', 'dashboard'] });
    },
  });
}
