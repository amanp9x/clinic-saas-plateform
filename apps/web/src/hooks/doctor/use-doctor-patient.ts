'use client';

import { useQuery } from '@tanstack/react-query';
import type { DoctorPatientProfileDto, PatientMedicalHistoryDto } from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

export function useDoctorPatientProfile(patientId: string | undefined) {
  return useQuery({
    queryKey: ['doctor', 'patients', patientId],
    queryFn: () => apiFetch<{ patient: DoctorPatientProfileDto }>(`/api/v1/doctor/patients/${patientId}`),
    select: (data) => data.patient,
    enabled: Boolean(patientId),
  });
}

export function usePatientMedicalHistory(patientId: string | undefined) {
  return useQuery({
    queryKey: ['doctor', 'patients', patientId, 'medical-history'],
    queryFn: () =>
      apiFetch<{ history: PatientMedicalHistoryDto }>(`/api/v1/doctor/patients/${patientId}/medical-history`),
    select: (data) => data.history,
    enabled: Boolean(patientId),
  });
}
