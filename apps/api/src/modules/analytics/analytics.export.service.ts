import { UserRole, CLINIC_PERMISSIONS } from '@clinic/shared';
import type { ReportType } from '@clinic/shared';
import { toCsv } from './analytics.util.js';
import { analyticsReportsService, type ReportFilters } from './analytics.reports.service.js';
import { assertClinicAnalyticsAccess } from './analytics-access.js';

/** Export never trusts client pagination — it always re-fetches with a single large page (capped)
 * from the exact same report service functions dashboards/reports use, so the exported CSV can
 * never diverge from what the UI shows for the same filters (spec: "reports must use the same
 * analytics service"). Capped at 5,000 rows to keep a single export request bounded — the same
 * spirit as this codebase's existing list endpoints capping `limit` at 100. */
const EXPORT_ROW_CAP = 5000;

export const analyticsExportService = {
  async exportCsv(userId: string, role: UserRole, clinicId: string, reportType: ReportType, filters: Omit<ReportFilters, 'page' | 'limit'>): Promise<{ filename: string; csv: string }> {
    // A doctor exporting their own performance/appointment/queue data needs no extra clinic
    // permission — the report functions below already force-scope a DOCTOR caller to their own
    // doctorId. Clinic staff/admins exporting clinic-wide data need the explicit export permission
    // ON TOP OF ANALYTICS_VIEW (still re-checked inside the reused report functions below) — export
    // is a strict superset of view, not a substitute for it, so a real grant gives both together.
    if (role !== UserRole.DOCTOR) {
      await assertClinicAnalyticsAccess(userId, role, clinicId, CLINIC_PERMISSIONS.ANALYTICS_EXPORT);
    }
    const exportFilters: ReportFilters = { ...filters, page: 1, limit: EXPORT_ROW_CAP };

    switch (reportType) {
      case 'appointments': {
        const { items } = await analyticsReportsService.appointmentReport(userId, role, clinicId, exportFilters);
        const csv = toCsv(
          ['Booking Reference', 'Patient', 'Doctor', 'Scheduled At', 'Status', 'Consultation Type', 'Checked In At', 'Completed At'],
          items.map((r) => [r.bookingReference, r.patientName, r.doctorName, r.scheduledAt, r.status, r.consultationType, r.checkedInAt, r.completedAt]),
        );
        return { filename: `appointment-report-${clinicId}.csv`, csv };
      }
      case 'revenue': {
        const { items } = await analyticsReportsService.revenueReport(userId, role, clinicId, exportFilters);
        const csv = toCsv(
          ['Booking Reference', 'Patient', 'Doctor', 'Status', 'Amount', 'Currency', 'Method', 'Captured At'],
          items.map((r) => [r.bookingReference, r.patientName, r.doctorName, r.status, r.amount, r.currency, r.method, r.capturedAt]),
        );
        return { filename: `revenue-report-${clinicId}.csv`, csv };
      }
      case 'doctors': {
        const { items } = await analyticsReportsService.doctorReport(userId, role, clinicId, exportFilters);
        const csv = toCsv(
          ['Doctor', 'Appointments', 'Completed', 'Cancelled', 'No-show', 'Avg Consultation (min)', 'Avg Waiting (min)', 'Avg Delay (min)', 'Revenue', 'Reviews', 'Avg Rating', 'Utilization'],
          items.map((r) => [r.doctorName, r.appointments, r.completed, r.cancelled, r.noShow, r.averageConsultationMinutes, r.averageWaitingMinutes, r.averageDelayMinutes, r.revenue, r.reviewCount, r.averageRating, r.utilization]),
        );
        return { filename: `doctor-performance-report-${clinicId}.csv`, csv };
      }
      case 'queue': {
        const { items } = await analyticsReportsService.queueReport(userId, role, clinicId, exportFilters);
        const csv = toCsv(
          ['Doctor', 'Session Date', 'Checked In', 'Called', 'Completed', 'Skipped', 'Avg Waiting (min)', 'Delay (min)'],
          items.map((r) => [r.doctorName, r.sessionDate, r.checkedIn, r.called, r.completed, r.skipped, r.averageWaitingMinutes, r.delayMinutes]),
        );
        return { filename: `queue-report-${clinicId}.csv`, csv };
      }
      case 'patients': {
        const { items } = await analyticsReportsService.patientReport(userId, role, clinicId, exportFilters);
        const csv = toCsv(
          ['Patient', 'Appointments', 'Completed', 'Cancelled', 'No-show', 'First Visit At', 'New In Range'],
          items.map((r) => [r.patientName, r.appointments, r.completed, r.cancelled, r.noShow, r.firstVisitAt, r.isNewInRange ? 'Yes' : 'No']),
        );
        return { filename: `patient-report-${clinicId}.csv`, csv };
      }
    }
  },
};
