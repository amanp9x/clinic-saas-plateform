'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DoctorPatientProfileDto, LabReportDto, PatientMedicalHistoryDto, VaccinationDto } from '@clinic/shared';
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

function historyKey(patientId: string | undefined) {
  return ['doctor', 'patients', patientId, 'medical-history'] as const;
}

export function useCreateLabReport(patientId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { testName: string; labName?: string; appointmentId?: string; notes?: string }) =>
      apiFetch<{ report: LabReportDto }>(`/api/v1/doctor/patients/${patientId}/lab-reports`, { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: historyKey(patientId) }),
  });
}

export function useUpdateLabReport(patientId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, status, reportDate, notes, file }: { reportId: string; status?: 'PENDING' | 'READY'; reportDate?: string; notes?: string; file?: File }) => {
      const formData = new FormData();
      if (status) formData.append('status', status);
      if (reportDate) formData.append('reportDate', reportDate);
      if (notes !== undefined) formData.append('notes', notes);
      if (file) formData.append('file', file);
      return apiFetch<{ report: LabReportDto }>(`/api/v1/doctor/patients/${patientId}/lab-reports/${reportId}`, { method: 'PATCH', body: formData });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: historyKey(patientId) }),
  });
}

export function useCreateVaccination(patientId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { vaccineName: string; doseNumber?: number; administeredDate: string; nextDueDate?: string; administeredBy?: string; notes?: string }) =>
      apiFetch<{ vaccination: VaccinationDto }>(`/api/v1/doctor/patients/${patientId}/vaccinations`, { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: historyKey(patientId) }),
  });
}
