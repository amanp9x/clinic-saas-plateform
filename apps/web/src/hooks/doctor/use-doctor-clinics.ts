'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClinicAssociationDto, ClinicAssociationUpdateInput } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

const CLINICS_KEY = ['doctor', 'clinics'] as const;

export function useDoctorClinics() {
  return useQuery({
    queryKey: CLINICS_KEY,
    queryFn: () => apiFetch<{ clinics: ClinicAssociationDto[] }>('/api/v1/doctor/clinics'),
    select: (data) => data.clinics,
  });
}

export function useUpdateClinicAssociation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clinicId, ...input }: ClinicAssociationUpdateInput & { clinicId: string }) =>
      apiFetch<{ clinic: ClinicAssociationDto }>(`/api/v1/doctor/clinics/${clinicId}`, {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLINICS_KEY }),
  });
}
