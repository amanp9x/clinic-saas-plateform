'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DoctorAppointmentDetailDto, DoctorAppointmentSummaryDto, DoctorAppointmentTab, PaginatedResult } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const APPOINTMENTS_KEY = ['doctor', 'appointments'] as const;

export function useDoctorAppointments(tab: DoctorAppointmentTab, clinicId?: string) {
  return useQuery({
    queryKey: [...APPOINTMENTS_KEY, tab, clinicId ?? null],
    queryFn: () =>
      apiFetch<PaginatedResult<DoctorAppointmentSummaryDto>>(
        `/api/v1/doctor/appointments?tab=${tab}${clinicId ? `&clinicId=${clinicId}` : ''}&limit=50`,
      ),
  });
}

export function useDoctorAppointmentDetail(id: string | undefined) {
  return useQuery({
    queryKey: [...APPOINTMENTS_KEY, id],
    queryFn: () => apiFetch<{ appointment: DoctorAppointmentDetailDto }>(`/api/v1/doctor/appointments/${id}`),
    select: (data) => data.appointment,
    enabled: Boolean(id),
  });
}

function useInvalidateAppointments() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
}

export function useStartConsultation() {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: (appointmentId: string) =>
      apiFetch<{ appointment: DoctorAppointmentDetailDto }>(`/api/v1/doctor/appointments/${appointmentId}/start`, {
        method: 'POST',
      }),
    onSuccess: invalidate,
  });
}

export function useMarkNoShow() {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: (appointmentId: string) =>
      apiFetch<{ appointment: DoctorAppointmentDetailDto }>(`/api/v1/doctor/appointments/${appointmentId}/no-show`, {
        method: 'POST',
      }),
    onSuccess: invalidate,
  });
}

export function useSkipAppointment() {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: ({ appointmentId, reason }: { appointmentId: string; reason?: string }) =>
      apiFetch<{ appointment: DoctorAppointmentDetailDto }>(`/api/v1/doctor/appointments/${appointmentId}/skip`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: invalidate,
  });
}
