import type { DashboardSummaryDto } from '@clinic/shared';
import { dashboardRepository } from './dashboard.repository.js';
import { appointmentsService } from '../appointments/appointments.service.js';
import { patientRepository } from '../patient/patient.repository.js';
import { NotFoundError } from '../../utils/app-error.js';

export const dashboardService = {
  async getSummary(userId: string): Promise<DashboardSummaryDto> {
    const patient = await patientRepository.findByUserId(userId);
    if (!patient) {
      throw new NotFoundError('Patient profile');
    }

    const [{ upcoming, today }, counts] = await Promise.all([
      appointmentsService.findUpcomingAndToday(userId),
      dashboardRepository.counts(patient.id, userId),
    ]);

    return {
      upcomingAppointment: upcoming,
      todayAppointment: today,
      ...counts,
    };
  },
};
