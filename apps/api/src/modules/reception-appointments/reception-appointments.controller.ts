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
};
