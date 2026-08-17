import type { Request, Response } from 'express';
import type { DateRangePreset, ReportType } from '@clinic/shared';
import { analyticsService } from './analytics.service.js';
import { analyticsReportsService } from './analytics.reports.service.js';
import { analyticsExportService } from './analytics.export.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

function rangeQuery(req: Request) {
  const q = req.query as { clinicId: string; range: string; from?: string; to?: string };
  return { clinicId: q.clinicId, rangeQuery: { range: q.range, from: q.from, to: q.to } };
}

function reportFilters(req: Request) {
  const q = req.query as Record<string, string | number>;
  return {
    range: q.range as DateRangePreset,
    from: q.from as string | undefined,
    to: q.to as string | undefined,
    doctorId: q.doctorId as string | undefined,
    status: q.status as string | undefined,
    paymentStatus: q.paymentStatus as string | undefined,
    consultationType: q.consultationType as string | undefined,
    page: Number(q.page),
    limit: Number(q.limit),
    sortDir: (q.sortDir as 'asc' | 'desc') ?? 'desc',
  };
}

export const analyticsController = {
  overview: asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, rangeQuery: rq } = rangeQuery(req);
    const result = await analyticsService.getOverview(req.user!.id, req.user!.role, clinicId, rq);
    sendSuccess(res, result);
  }),

  appointments: asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, rangeQuery: rq } = rangeQuery(req);
    const q = req.query as { doctorId?: string; trend?: 'day' | 'week' | 'month' };
    const result = await analyticsService.getAppointmentAnalytics(req.user!.id, req.user!.role, clinicId, rq, q.doctorId, q.trend);
    sendSuccess(res, result);
  }),

  revenue: asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, rangeQuery: rq } = rangeQuery(req);
    const q = req.query as { groupBy?: 'day' | 'week' | 'month' | 'doctor' | 'method' | 'consultationType' };
    const result = await analyticsService.getRevenueAnalytics(req.user!.id, req.user!.role, clinicId, rq, q.groupBy);
    sendSuccess(res, result);
  }),

  payments: asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, rangeQuery: rq } = rangeQuery(req);
    const result = await analyticsService.getPaymentAnalytics(req.user!.id, req.user!.role, clinicId, rq);
    sendSuccess(res, result);
  }),

  doctors: asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, rangeQuery: rq } = rangeQuery(req);
    const q = req.query as { doctorId?: string };
    const result = await analyticsService.getDoctorPerformance(req.user!.id, req.user!.role, clinicId, rq, q.doctorId);
    sendSuccess(res, result);
  }),

  doctorAvailability: asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, rangeQuery: rq } = rangeQuery(req);
    const result = await analyticsService.getDoctorAvailability(req.user!.id, req.user!.role, clinicId, req.params.doctorId as string, rq);
    sendSuccess(res, result);
  }),

  delay: asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, rangeQuery: rq } = rangeQuery(req);
    const result = await analyticsService.getDelayAnalytics(req.user!.id, req.user!.role, clinicId, rq);
    sendSuccess(res, result);
  }),

  queue: asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, rangeQuery: rq } = rangeQuery(req);
    const q = req.query as { doctorId?: string };
    const result = await analyticsService.getQueueAnalytics(req.user!.id, req.user!.role, clinicId, rq, q.doctorId);
    sendSuccess(res, result);
  }),

  patients: asyncHandler(async (req: Request, res: Response) => {
    const { clinicId, rangeQuery: rq } = rangeQuery(req);
    const result = await analyticsService.getPatientAnalytics(req.user!.id, req.user!.role, clinicId, rq);
    sendSuccess(res, result);
  }),

  compareClinics: asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as { clinicIds: string[]; range: string; from?: string; to?: string };
    const result = await analyticsService.compareClinics(req.user!.id, req.user!.role, q.clinicIds, { range: q.range, from: q.from, to: q.to });
    sendSuccess(res, result);
  }),

  reportAppointments: asyncHandler(async (req: Request, res: Response) => {
    const clinicId = (req.query as { clinicId: string }).clinicId;
    const result = await analyticsReportsService.appointmentReport(req.user!.id, req.user!.role, clinicId, reportFilters(req));
    // PaginatedResult<T> goes straight into `data`, matching the convention every other paginated
    // endpoint in this codebase uses (payments, clinic-billing, etc.) — `apiFetch` on the web side
    // only ever unwraps `data`, so a meta-based shape would silently lose page/limit/total there.
    sendSuccess(res, result);
  }),

  reportRevenue: asyncHandler(async (req: Request, res: Response) => {
    const clinicId = (req.query as { clinicId: string }).clinicId;
    const result = await analyticsReportsService.revenueReport(req.user!.id, req.user!.role, clinicId, reportFilters(req));
    // PaginatedResult<T> goes straight into `data`, matching the convention every other paginated
    // endpoint in this codebase uses (payments, clinic-billing, etc.) — `apiFetch` on the web side
    // only ever unwraps `data`, so a meta-based shape would silently lose page/limit/total there.
    sendSuccess(res, result);
  }),

  reportDoctors: asyncHandler(async (req: Request, res: Response) => {
    const clinicId = (req.query as { clinicId: string }).clinicId;
    const result = await analyticsReportsService.doctorReport(req.user!.id, req.user!.role, clinicId, reportFilters(req));
    // PaginatedResult<T> goes straight into `data`, matching the convention every other paginated
    // endpoint in this codebase uses (payments, clinic-billing, etc.) — `apiFetch` on the web side
    // only ever unwraps `data`, so a meta-based shape would silently lose page/limit/total there.
    sendSuccess(res, result);
  }),

  reportQueue: asyncHandler(async (req: Request, res: Response) => {
    const clinicId = (req.query as { clinicId: string }).clinicId;
    const result = await analyticsReportsService.queueReport(req.user!.id, req.user!.role, clinicId, reportFilters(req));
    // PaginatedResult<T> goes straight into `data`, matching the convention every other paginated
    // endpoint in this codebase uses (payments, clinic-billing, etc.) — `apiFetch` on the web side
    // only ever unwraps `data`, so a meta-based shape would silently lose page/limit/total there.
    sendSuccess(res, result);
  }),

  reportPatients: asyncHandler(async (req: Request, res: Response) => {
    const clinicId = (req.query as { clinicId: string }).clinicId;
    const result = await analyticsReportsService.patientReport(req.user!.id, req.user!.role, clinicId, reportFilters(req));
    // PaginatedResult<T> goes straight into `data`, matching the convention every other paginated
    // endpoint in this codebase uses (payments, clinic-billing, etc.) — `apiFetch` on the web side
    // only ever unwraps `data`, so a meta-based shape would silently lose page/limit/total there.
    sendSuccess(res, result);
  }),

  exportReport: asyncHandler(async (req: Request, res: Response) => {
    const clinicId = (req.query as { clinicId: string }).clinicId;
    const reportType = req.params.reportType as ReportType;
    const filters = reportFilters(req);
    const { filename, csv } = await analyticsExportService.exportCsv(req.user!.id, req.user!.role, clinicId, reportType, filters);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  }),
};
