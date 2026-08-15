import type { Request, Response } from 'express';
import type { PatientSearchQuery, ReceptionAppointmentListQuery } from '@clinic/shared';
import { receptionAppointmentsService } from './reception-appointments.service.js';
import { sendSuccess } from '../../utils/api-response.js';
import { asyncHandler } from '../../utils/async-handler.js';

export const receptionAppointmentsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const appointments = await receptionAppointmentsService.list(req.user!.id, req.user!.role, req.query as unknown as ReceptionAppointmentListQuery);
    sendSuccess(res, { appointments });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const appointment = await receptionAppointmentsService.getById(req.user!.id, req.user!.role, req.query.clinicId as string, req.params.id as string);
    sendSuccess(res, { appointment });
  }),

  searchPatients: asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as PatientSearchQuery;
    const patients = await receptionAppointmentsService.searchPatients(req.user!.id, req.user!.role, query.clinicId, query.q, query.page, query.limit);
    sendSuccess(res, { patients });
  }),

  quickView: asyncHandler(async (req: Request, res: Response) => {
    const patient = await receptionAppointmentsService.quickView(req.user!.id, req.user!.role, req.query.clinicId as string, req.params.patientId as string);
    sendSuccess(res, { patient });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const appointment = await receptionAppointmentsService.create(req.user!.id, req.user!.role, req.body);
    sendSuccess(res, { appointment }, { status: 201, message: 'Appointment booked' });
  }),

  reschedule: asyncHandler(async (req: Request, res: Response) => {
    const appointment = await receptionAppointmentsService.reschedule(
      req.user!.id,
      req.user!.role,
      req.query.clinicId as string,
      req.params.id as string,
      req.body,
    );
    sendSuccess(res, { appointment }, { message: 'Appointment rescheduled' });
  }),

  cancel: asyncHandler(async (req: Request, res: Response) => {
    const appointment = await receptionAppointmentsService.cancel(
      req.user!.id,
      req.user!.role,
      req.query.clinicId as string,
      req.params.id as string,
      req.body,
    );
    sendSuccess(res, { appointment }, { message: 'Appointment cancelled' });
  }),

  markNoShow: asyncHandler(async (req: Request, res: Response) => {
    const appointment = await receptionAppointmentsService.markNoShow(
      req.user!.id,
      req.user!.role,
      req.body.clinicId as string,
      req.params.id as string,
    );
    sendSuccess(res, { appointment }, { message: 'Appointment marked no-show' });
  }),
};
