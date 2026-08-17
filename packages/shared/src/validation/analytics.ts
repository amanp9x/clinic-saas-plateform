import { z } from 'zod';
import { DATE_RANGE_PRESETS } from '../types/analytics.js';

/** Shared by every analytics/report endpoint. `range` selects a preset; `from`/`to` are required
 * (and validated) only when `range === 'custom'` — enforced in analytics.util.ts's
 * `resolveDateRange`, not here, since the cross-field rule depends on the preset value itself. */
export const analyticsDateRangeQuerySchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  range: z.enum(DATE_RANGE_PRESETS).default('last7days'),
  from: z.string().date('Enter a valid date').optional(),
  to: z.string().date('Enter a valid date').optional(),
});
export type AnalyticsDateRangeQuery = z.infer<typeof analyticsDateRangeQuerySchema>;

export const analyticsRevenueQuerySchema = analyticsDateRangeQuerySchema.extend({
  groupBy: z.enum(['day', 'week', 'month', 'doctor', 'method', 'consultationType']).optional(),
});
export type AnalyticsRevenueQuery = z.infer<typeof analyticsRevenueQuerySchema>;

export const analyticsDoctorsQuerySchema = analyticsDateRangeQuerySchema.extend({
  doctorId: z.string().uuid().optional(),
});
export type AnalyticsDoctorsQuery = z.infer<typeof analyticsDoctorsQuerySchema>;

export const analyticsReportQuerySchema = analyticsDateRangeQuerySchema.extend({
  doctorId: z.string().uuid().optional(),
  specializationId: z.string().uuid().optional(),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  consultationType: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
export type AnalyticsReportQuery = z.infer<typeof analyticsReportQuerySchema>;

export const analyticsExportParamSchema = z.object({
  reportType: z.enum(['appointments', 'revenue', 'doctors', 'queue', 'patients']),
});
export type AnalyticsExportParam = z.infer<typeof analyticsExportParamSchema>;

export const analyticsClinicCompareQuerySchema = z.object({
  clinicIds: z
    .string()
    .min(1, 'Select at least one clinic')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
  range: z.enum(DATE_RANGE_PRESETS).default('last30days'),
  from: z.string().date('Enter a valid date').optional(),
  to: z.string().date('Enter a valid date').optional(),
});
export type AnalyticsClinicCompareQuery = z.infer<typeof analyticsClinicCompareQuerySchema>;
