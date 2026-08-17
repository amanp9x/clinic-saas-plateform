import { Router } from 'express';
import { UserRole } from '@clinic/shared';
import {
  analyticsDateRangeQuerySchema,
  analyticsRevenueQuerySchema,
  analyticsDoctorsQuerySchema,
  analyticsReportQuerySchema,
  analyticsExportParamSchema,
  analyticsClinicCompareQuerySchema,
} from '@clinic/shared';
import { z } from 'zod';
import { analyticsController } from './analytics.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';

export const analyticsRouter = Router();

// Patients are never authorized — no PATIENT role in this list, and every service function
// re-checks role server-side regardless (defense in depth, same idiom as every other module).
analyticsRouter.use(authenticate, authorize(UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.CLINIC_STAFF, UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN));

const doctorsQuerySchema = analyticsDoctorsQuerySchema;
const queueQuerySchema = analyticsDateRangeQuerySchema.extend({ doctorId: z.string().uuid().optional() });
const appointmentsQuerySchema = analyticsDateRangeQuerySchema.extend({ doctorId: z.string().uuid().optional(), trend: z.enum(['day', 'week', 'month']).optional() });
const availabilityParamSchema = z.object({ doctorId: z.string().uuid() });

analyticsRouter.get('/overview', validate({ query: analyticsDateRangeQuerySchema }), analyticsController.overview);
analyticsRouter.get('/appointments', validate({ query: appointmentsQuerySchema }), analyticsController.appointments);
analyticsRouter.get('/revenue', validate({ query: analyticsRevenueQuerySchema }), analyticsController.revenue);
analyticsRouter.get('/payments', validate({ query: analyticsDateRangeQuerySchema }), analyticsController.payments);
analyticsRouter.get('/doctors', validate({ query: doctorsQuerySchema }), analyticsController.doctors);
analyticsRouter.get('/doctors/:doctorId/availability', validate({ params: availabilityParamSchema, query: analyticsDateRangeQuerySchema }), analyticsController.doctorAvailability);
analyticsRouter.get('/delay', validate({ query: analyticsDateRangeQuerySchema }), analyticsController.delay);
analyticsRouter.get('/queue', validate({ query: queueQuerySchema }), analyticsController.queue);
analyticsRouter.get('/patients', validate({ query: analyticsDateRangeQuerySchema }), analyticsController.patients);
analyticsRouter.get('/clinics/compare', validate({ query: analyticsClinicCompareQuerySchema }), analyticsController.compareClinics);

analyticsRouter.get('/reports/appointments', validate({ query: analyticsReportQuerySchema }), analyticsController.reportAppointments);
analyticsRouter.get('/reports/revenue', validate({ query: analyticsReportQuerySchema }), analyticsController.reportRevenue);
analyticsRouter.get('/reports/doctors', validate({ query: analyticsReportQuerySchema }), analyticsController.reportDoctors);
analyticsRouter.get('/reports/queue', validate({ query: analyticsReportQuerySchema }), analyticsController.reportQueue);
analyticsRouter.get('/reports/patients', validate({ query: analyticsReportQuerySchema }), analyticsController.reportPatients);

analyticsRouter.get('/export/:reportType', validate({ params: analyticsExportParamSchema, query: analyticsReportQuerySchema }), analyticsController.exportReport);
