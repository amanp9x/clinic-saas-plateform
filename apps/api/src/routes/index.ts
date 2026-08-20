import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';
import { catalogRouter } from '../modules/catalog/catalog.routes.js';
import { contactRouter } from '../modules/contact/contact.routes.js';
import { patientRouter } from '../modules/patient/patient.routes.js';
import { favoritesRouter } from '../modules/favorites/favorites.routes.js';
import { appointmentsRouter } from '../modules/appointments/appointments.routes.js';
import { medicalRecordsRouter } from '../modules/medical-records/medical-records.routes.js';
import { notificationsRouter } from '../modules/notifications/notifications.routes.js';
import { notificationPreferencesRouter } from '../modules/notifications/notification-preferences.routes.js';
import { clinicAnnouncementRouter } from '../modules/notifications/clinic-announcement.routes.js';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes.js';
import { doctorRouter } from '../modules/doctor/doctor.routes.js';
import { doctorAppointmentsRouter } from '../modules/doctor-appointments/doctor-appointments.routes.js';
import { doctorPatientsRouter } from '../modules/doctor-patients/doctor-patients.routes.js';
import { queueRouter } from '../modules/doctor-queue/queue.routes.js';
import { consultationRouter } from '../modules/doctor-consultation/consultation.routes.js';
import { prescriptionRouter, signatureRouter } from '../modules/doctor-prescription/prescription.routes.js';
import { receptionRouter } from '../modules/reception/reception.routes.js';
import { receptionCheckinRouter } from '../modules/reception-checkin/reception-checkin.routes.js';
import { receptionQueueRouter } from '../modules/reception-queue/reception-queue.routes.js';
import { receptionAppointmentsRouter } from '../modules/reception-appointments/reception-appointments.routes.js';
import { clinicRouter } from '../modules/clinic/clinic.routes.js';
import { clinicDoctorsRouter } from '../modules/clinic-doctors/clinic-doctors.routes.js';
import { clinicDepartmentsRouter } from '../modules/clinic-departments/clinic-departments.routes.js';
import { clinicServicesRouter } from '../modules/clinic-services/clinic-services.routes.js';
import { clinicScheduleRouter } from '../modules/clinic-schedule/clinic-schedule.routes.js';
import { clinicHolidaysRouter } from '../modules/clinic-holidays/clinic-holidays.routes.js';
import { clinicResourcesRouter } from '../modules/clinic-resources/clinic-resources.routes.js';
import { clinicStaffRouter } from '../modules/clinic-staff/clinic-staff.routes.js';
import { clinicAuditRouter } from '../modules/clinic-audit/clinic-audit.routes.js';
import { clinicReportsRouter } from '../modules/clinic-reports/clinic-reports.routes.js';
import { blockedSlotsRouter } from '../modules/blocked-slots/blocked-slots.routes.js';
import { paymentsRouter } from '../modules/payments/payment.routes.js';
import { paymentWebhooksRouter } from '../modules/payments/webhook.routes.js';
import { clinicBillingRouter } from '../modules/clinic-billing/clinic-billing.routes.js';
import { analyticsRouter } from '../modules/analytics/analytics.routes.js';
import { reviewsRouter } from '../modules/reviews/reviews.routes.js';
import { reviewModerationRouter } from '../modules/reviews/review-moderation.routes.js';
import { waitlistRouter } from '../modules/waitlist/waitlist.routes.js';
import { clinicWaitlistRouter } from '../modules/waitlist/clinic-waitlist.routes.js';
import { clinicFollowUpsRouter } from '../modules/follow-up/clinic-follow-ups.routes.js';
import { platformAdminRouter } from '../modules/platform-admin/platform-admin.routes.js';
import { supportTicketRouter } from '../modules/support-tickets/support-ticket.routes.js';
import { platformSupportTicketsRouter } from '../modules/support-tickets/platform-support-tickets.routes.js';
import { prescriptionRefillRouter, doctorRefillRequestsRouter } from '../modules/prescription-refill/prescription-refill.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/catalog', catalogRouter);
apiRouter.use('/contact', contactRouter);
apiRouter.use('/patient', patientRouter);
apiRouter.use('/favorites', favoritesRouter);
apiRouter.use('/appointments', appointmentsRouter);
apiRouter.use('/medical-records', medicalRecordsRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/notification-preferences', notificationPreferencesRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/analytics', analyticsRouter);
apiRouter.use('/reviews', reviewsRouter);
apiRouter.use('/waitlist', waitlistRouter);
apiRouter.use('/support/tickets', supportTicketRouter);
apiRouter.use('/prescriptions', prescriptionRefillRouter);

// --- Payments & Billing (Phase 9) --------------------------------------------
// The webhook router (unauthenticated, signature-verified) must be registered before the
// authenticated `/payments` router — same prefix-ordering reason as the `/clinic/*` block below.
apiRouter.use('/payments/webhooks', paymentWebhooksRouter);
apiRouter.use('/payments', paymentsRouter);

// --- Doctor Portal (Phase 4) -------------------------------------------------
apiRouter.use('/doctor', doctorRouter);
apiRouter.use('/doctor/appointments', doctorAppointmentsRouter);
apiRouter.use('/doctor/patients', doctorPatientsRouter);
apiRouter.use('/doctor/queue', queueRouter);
apiRouter.use('/doctor/consultations', consultationRouter);
apiRouter.use('/doctor/prescriptions', prescriptionRouter);
apiRouter.use('/doctor/settings/signature', signatureRouter);
apiRouter.use('/doctor/refill-requests', doctorRefillRequestsRouter);

// --- Reception / Clinic Staff Portal (Phase 5) -------------------------------
apiRouter.use('/reception', receptionRouter);
apiRouter.use('/reception', receptionCheckinRouter);
apiRouter.use('/reception/queue', receptionQueueRouter);
apiRouter.use('/reception', receptionAppointmentsRouter);

// --- Clinic Management (Phase 6) ---------------------------------------------
// More specific `/clinic/*` prefixes are mounted before the bare `/clinic` router — Express
// tries mount prefixes in registration order, so `/clinic` (registered first) would otherwise
// swallow every `/clinic/xxx/...` request into its own auth gate before falling through, which
// breaks clinicStaffRouter's one public route (invitation acceptance has no session yet).
apiRouter.use('/clinic/doctors', clinicDoctorsRouter);
apiRouter.use('/clinic/departments', clinicDepartmentsRouter);
apiRouter.use('/clinic/services', clinicServicesRouter);
apiRouter.use('/clinic/schedule', clinicScheduleRouter);
apiRouter.use('/clinic/holidays', clinicHolidaysRouter);
apiRouter.use('/clinic/resources', clinicResourcesRouter);
apiRouter.use('/clinic/staff', clinicStaffRouter);
apiRouter.use('/clinic/audit-logs', clinicAuditRouter);
apiRouter.use('/clinic/reports', clinicReportsRouter);
apiRouter.use('/clinic/blocked-slots', blockedSlotsRouter);
apiRouter.use('/clinic/billing', clinicBillingRouter);
apiRouter.use('/clinic/announcements', clinicAnnouncementRouter);
apiRouter.use('/clinic/reviews', reviewModerationRouter);
apiRouter.use('/clinic/waitlist', clinicWaitlistRouter);
apiRouter.use('/clinic/follow-ups', clinicFollowUpsRouter);
// More specific than the bare '/platform-admin' mount below — must be registered first, same
// prefix-ordering reason as the '/clinic/*' block above.
apiRouter.use('/platform-admin/tickets', platformSupportTicketsRouter);
apiRouter.use('/platform-admin', platformAdminRouter);
apiRouter.use('/clinic', clinicRouter);
