'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  AnalyticsOverviewDto,
  AppointmentBreakdownDto,
  AppointmentReportRowDto,
  ClinicComparisonRowDto,
  DateRangePreset,
  DelayAnalyticsRowDto,
  DoctorAvailabilityDto,
  DoctorPerformanceRowDto,
  PaginatedResult,
  PatientBreakdownDto,
  PatientReportRowDto,
  PaymentBreakdownDto,
  QueueBreakdownDto,
  QueueReportRowDto,
  ResolvedDateRangeDto,
  RevenueBreakdownDto,
  RevenueReportRowDto,
  TrendPointDto,
} from '@clinic/shared';
import { apiFetch, ApiError } from '@/lib/api-client';
import { clientEnv } from '@/lib/env';
import { tokenStore } from '@/lib/token-store';

export interface AnalyticsRangeParams {
  range: DateRangePreset;
  from?: string;
  to?: string;
}

function rangeQuery(clinicId: string | undefined, params: AnalyticsRangeParams, extra: Record<string, string | number | undefined> = {}): string {
  const search = new URLSearchParams();
  if (clinicId) search.set('clinicId', clinicId);
  search.set('range', params.range);
  if (params.range === 'custom') {
    if (params.from) search.set('from', params.from);
    if (params.to) search.set('to', params.to);
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  return search.toString();
}

const ANALYTICS_KEY = ['analytics'] as const;

export function useAnalyticsOverview(clinicId: string | undefined, params: AnalyticsRangeParams) {
  return useQuery({
    queryKey: [...ANALYTICS_KEY, 'overview', clinicId ?? null, params],
    queryFn: () => apiFetch<AnalyticsOverviewDto>(`/api/v1/analytics/overview?${rangeQuery(clinicId, params)}`),
    enabled: Boolean(clinicId),
  });
}

export function useAppointmentAnalytics(clinicId: string | undefined, params: AnalyticsRangeParams, opts: { doctorId?: string; trend?: 'day' | 'week' | 'month' } = {}) {
  return useQuery({
    queryKey: [...ANALYTICS_KEY, 'appointments', clinicId ?? null, params, opts],
    queryFn: () =>
      apiFetch<{ range: ResolvedDateRangeDto; breakdown: AppointmentBreakdownDto; trend: TrendPointDto[] }>(
        `/api/v1/analytics/appointments?${rangeQuery(clinicId, params, opts)}`,
      ),
    enabled: Boolean(clinicId),
  });
}

export function useRevenueAnalytics(clinicId: string | undefined, params: AnalyticsRangeParams, groupBy?: string) {
  return useQuery({
    queryKey: [...ANALYTICS_KEY, 'revenue', clinicId ?? null, params, groupBy ?? null],
    queryFn: () =>
      apiFetch<{ range: ResolvedDateRangeDto; breakdown: RevenueBreakdownDto; groupBy: string | null; breakdownBy: unknown[] }>(
        `/api/v1/analytics/revenue?${rangeQuery(clinicId, params, { groupBy })}`,
      ),
    enabled: Boolean(clinicId),
  });
}

export function usePaymentAnalytics(clinicId: string | undefined, params: AnalyticsRangeParams) {
  return useQuery({
    queryKey: [...ANALYTICS_KEY, 'payments', clinicId ?? null, params],
    queryFn: () => apiFetch<{ range: ResolvedDateRangeDto; breakdown: PaymentBreakdownDto }>(`/api/v1/analytics/payments?${rangeQuery(clinicId, params)}`),
    enabled: Boolean(clinicId),
  });
}

export function useQueueAnalytics(clinicId: string | undefined, params: AnalyticsRangeParams, doctorId?: string) {
  return useQuery({
    queryKey: [...ANALYTICS_KEY, 'queue', clinicId ?? null, params, doctorId ?? null],
    queryFn: () => apiFetch<{ range: ResolvedDateRangeDto; breakdown: QueueBreakdownDto }>(`/api/v1/analytics/queue?${rangeQuery(clinicId, params, { doctorId })}`),
    enabled: Boolean(clinicId),
  });
}

export function usePatientAnalytics(clinicId: string | undefined, params: AnalyticsRangeParams) {
  return useQuery({
    queryKey: [...ANALYTICS_KEY, 'patients', clinicId ?? null, params],
    queryFn: () => apiFetch<{ range: ResolvedDateRangeDto; breakdown: PatientBreakdownDto }>(`/api/v1/analytics/patients?${rangeQuery(clinicId, params)}`),
    enabled: Boolean(clinicId),
  });
}

export function useDoctorPerformance(clinicId: string | undefined, params: AnalyticsRangeParams, doctorId?: string) {
  return useQuery({
    queryKey: [...ANALYTICS_KEY, 'doctors', clinicId ?? null, params, doctorId ?? null],
    queryFn: () => apiFetch<{ rows: DoctorPerformanceRowDto[] }>(`/api/v1/analytics/doctors?${rangeQuery(clinicId, params, { doctorId })}`),
    enabled: Boolean(clinicId),
    select: (data) => data.rows,
  });
}

export function useDoctorAvailability(clinicId: string | undefined, doctorId: string | undefined, params: AnalyticsRangeParams) {
  return useQuery({
    queryKey: [...ANALYTICS_KEY, 'doctor-availability', clinicId ?? null, doctorId ?? null, params],
    queryFn: () => apiFetch<DoctorAvailabilityDto>(`/api/v1/analytics/doctors/${doctorId}/availability?${rangeQuery(clinicId, params)}`),
    enabled: Boolean(clinicId && doctorId),
  });
}

export function useDelayAnalytics(clinicId: string | undefined, params: AnalyticsRangeParams) {
  return useQuery({
    queryKey: [...ANALYTICS_KEY, 'delay', clinicId ?? null, params],
    queryFn: () => apiFetch<{ rows: DelayAnalyticsRowDto[] }>(`/api/v1/analytics/delay?${rangeQuery(clinicId, params)}`),
    enabled: Boolean(clinicId),
    select: (data) => data.rows,
  });
}

export function useClinicComparison(clinicIds: string[], params: AnalyticsRangeParams) {
  return useQuery({
    queryKey: [...ANALYTICS_KEY, 'compare', clinicIds, params],
    queryFn: () =>
      apiFetch<{ rows: ClinicComparisonRowDto[] }>(
        `/api/v1/analytics/clinics/compare?clinicIds=${clinicIds.join(',')}&range=${params.range}${params.from ? `&from=${params.from}` : ''}${params.to ? `&to=${params.to}` : ''}`,
      ),
    enabled: clinicIds.length > 0,
    select: (data) => data.rows,
  });
}

export interface ReportFilterParams extends AnalyticsRangeParams {
  doctorId?: string;
  status?: string;
  paymentStatus?: string;
  page?: number;
  limit?: number;
  sortDir?: 'asc' | 'desc';
}

function reportQuery(clinicId: string | undefined, params: ReportFilterParams): string {
  return rangeQuery(clinicId, params, {
    doctorId: params.doctorId,
    status: params.status,
    paymentStatus: params.paymentStatus,
    page: params.page,
    limit: params.limit,
    sortDir: params.sortDir,
  });
}

export function useAppointmentReport(clinicId: string | undefined, params: ReportFilterParams) {
  return useQuery({
    queryKey: [...ANALYTICS_KEY, 'report-appointments', clinicId ?? null, params],
    queryFn: () => apiFetch<PaginatedResult<AppointmentReportRowDto>>(`/api/v1/analytics/reports/appointments?${reportQuery(clinicId, params)}`),
    enabled: Boolean(clinicId),
  });
}

export function useRevenueReport(clinicId: string | undefined, params: ReportFilterParams) {
  return useQuery({
    queryKey: [...ANALYTICS_KEY, 'report-revenue', clinicId ?? null, params],
    queryFn: () => apiFetch<PaginatedResult<RevenueReportRowDto>>(`/api/v1/analytics/reports/revenue?${reportQuery(clinicId, params)}`),
    enabled: Boolean(clinicId),
  });
}

export function useDoctorReport(clinicId: string | undefined, params: ReportFilterParams) {
  return useQuery({
    queryKey: [...ANALYTICS_KEY, 'report-doctors', clinicId ?? null, params],
    queryFn: () => apiFetch<PaginatedResult<DoctorPerformanceRowDto>>(`/api/v1/analytics/reports/doctors?${reportQuery(clinicId, params)}`),
    enabled: Boolean(clinicId),
  });
}

export function useQueueReport(clinicId: string | undefined, params: ReportFilterParams) {
  return useQuery({
    queryKey: [...ANALYTICS_KEY, 'report-queue', clinicId ?? null, params],
    queryFn: () => apiFetch<PaginatedResult<QueueReportRowDto>>(`/api/v1/analytics/reports/queue?${reportQuery(clinicId, params)}`),
    enabled: Boolean(clinicId),
  });
}

export function usePatientReport(clinicId: string | undefined, params: ReportFilterParams) {
  return useQuery({
    queryKey: [...ANALYTICS_KEY, 'report-patients', clinicId ?? null, params],
    queryFn: () => apiFetch<PaginatedResult<PatientReportRowDto>>(`/api/v1/analytics/reports/patients?${reportQuery(clinicId, params)}`),
    enabled: Boolean(clinicId),
  });
}

/** CSV export returns a raw file, not the `{success, data}` envelope — fetched as a blob (same
 * pattern as `downloadReceipt` for invoice PDFs) and triggered as a browser download. */
export async function downloadAnalyticsExport(
  clinicId: string,
  reportType: 'appointments' | 'revenue' | 'doctors' | 'queue' | 'patients',
  params: ReportFilterParams,
  filename: string,
): Promise<void> {
  const accessToken = tokenStore.get();
  const res = await fetch(`${clientEnv.apiUrl}/api/v1/analytics/export/${reportType}?${reportQuery(clinicId, params)}`, {
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (!res.ok) {
    throw new ApiError('DOWNLOAD_FAILED', 'Could not export the report', res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
