'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  DownloadItemDto,
  LabReportDto,
  MedicalRecordDto,
  PrescriptionDto,
  VaccinationDto,
  VitalRecordDto,
} from '@clinic/shared';
import { apiFetch } from '@/lib/api-client';

export function useMedicalHistory() {
  return useQuery({
    queryKey: ['patient', 'medical-records', 'history'],
    queryFn: () => apiFetch<{ records: MedicalRecordDto[] }>('/api/v1/medical-records/history'),
    select: (data) => data.records,
  });
}

export function usePrescriptions() {
  return useQuery({
    queryKey: ['patient', 'medical-records', 'prescriptions'],
    queryFn: () =>
      apiFetch<{ prescriptions: PrescriptionDto[] }>('/api/v1/medical-records/prescriptions'),
    select: (data) => data.prescriptions,
  });
}

export function useLabReports() {
  return useQuery({
    queryKey: ['patient', 'medical-records', 'reports'],
    queryFn: () => apiFetch<{ reports: LabReportDto[] }>('/api/v1/medical-records/reports'),
    select: (data) => data.reports,
  });
}

export function useVaccinations() {
  return useQuery({
    queryKey: ['patient', 'medical-records', 'vaccinations'],
    queryFn: () =>
      apiFetch<{ vaccinations: VaccinationDto[] }>('/api/v1/medical-records/vaccinations'),
    select: (data) => data.vaccinations,
  });
}

export function useVitals() {
  return useQuery({
    queryKey: ['patient', 'medical-records', 'vitals'],
    queryFn: () => apiFetch<{ vitals: VitalRecordDto[] }>('/api/v1/medical-records/vitals'),
    select: (data) => data.vitals,
  });
}

export function useDownloads() {
  return useQuery({
    queryKey: ['patient', 'medical-records', 'downloads'],
    queryFn: () => apiFetch<{ downloads: DownloadItemDto[] }>('/api/v1/medical-records/downloads'),
    select: (data) => data.downloads,
  });
}
