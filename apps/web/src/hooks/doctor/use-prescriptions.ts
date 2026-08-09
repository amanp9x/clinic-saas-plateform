'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DoctorPrescriptionDto, PaginatedResult, PrescriptionCreateInput, PrescriptionUpdateInput } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const PRESCRIPTIONS_KEY = ['doctor', 'prescriptions'] as const;

export function usePrescriptions(filters: { patientId?: string; appointmentId?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.patientId) params.set('patientId', filters.patientId);
  if (filters.appointmentId) params.set('appointmentId', filters.appointmentId);

  return useQuery({
    queryKey: [...PRESCRIPTIONS_KEY, filters],
    queryFn: () => apiFetch<PaginatedResult<DoctorPrescriptionDto>>(`/api/v1/doctor/prescriptions?${params.toString()}`),
  });
}

export function usePrescriptionDetail(id: string | undefined) {
  return useQuery({
    queryKey: [...PRESCRIPTIONS_KEY, id],
    queryFn: () => apiFetch<{ prescription: DoctorPrescriptionDto }>(`/api/v1/doctor/prescriptions/${id}`),
    select: (data) => data.prescription,
    enabled: Boolean(id),
  });
}

function useInvalidatePrescriptions() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: PRESCRIPTIONS_KEY });
}

export function useCreatePrescription() {
  const invalidate = useInvalidatePrescriptions();
  return useMutation({
    mutationFn: (input: PrescriptionCreateInput) =>
      apiFetch<{ prescription: DoctorPrescriptionDto }>('/api/v1/doctor/prescriptions', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useUpdatePrescription() {
  const invalidate = useInvalidatePrescriptions();
  return useMutation({
    mutationFn: ({ id, ...input }: PrescriptionUpdateInput & { id: string }) =>
      apiFetch<{ prescription: DoctorPrescriptionDto }>(`/api/v1/doctor/prescriptions/${id}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: invalidate,
  });
}

export function useFinalizePrescription() {
  const invalidate = useInvalidatePrescriptions();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ prescription: DoctorPrescriptionDto }>(`/api/v1/doctor/prescriptions/${id}/finalize`, {
        method: 'POST',
      }),
    onSuccess: invalidate,
  });
}
