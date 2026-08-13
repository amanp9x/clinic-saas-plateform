import { CLINIC_PERMISSIONS, type UserRole } from '@clinic/shared';
import type {
  PaginatedResult,
  PatientQuickViewDto,
  PatientSearchResultDto,
  ReceptionAppointmentDetailDto,
  ReceptionAppointmentListQuery,
  ReceptionAppointmentSummaryDto,
} from '@clinic/shared';
import type { TokenPriority, TokenStatus } from '@prisma/client';
import { receptionAppointmentsRepository } from './reception-appointments.repository.js';
import { toReceptionAppointmentDetail, toReceptionAppointmentSummary } from './reception-appointments.mappers.js';
import { queueRepository } from '../doctor-queue/queue.repository.js';
import { assertClinicPermission } from '../reception/reception.shared.js';
import { calculateAge } from '../../utils/age.js';
import { NotFoundError } from '../../utils/app-error.js';

async function queuePositionFor(token: { id: string; status: TokenStatus; doctorSessionId: string; priority: TokenPriority; tokenNumber: number } | null | undefined) {
  if (!token) return null;
  if (token.status === 'WAITING') return (await queueRepository.countWaitingAhead(token.doctorSessionId, token)) + 1;
  if (token.status === 'CALLED') return 0;
  return null;
}

export const receptionAppointmentsService = {
  async list(userId: string, role: UserRole, query: ReceptionAppointmentListQuery): Promise<PaginatedResult<ReceptionAppointmentSummaryDto>> {
    await assertClinicPermission(userId, role, query.clinicId, CLINIC_PERMISSIONS.QUEUE_VIEW);
    const { items, total } = await receptionAppointmentsRepository.list(query.clinicId, query.tab, query.doctorId, query.page, query.limit);
    const mapped = await Promise.all(items.map(async (a) => toReceptionAppointmentSummary(a, await queuePositionFor(a.queueToken))));
    return {
      items: mapped,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  },

  async getById(userId: string, role: UserRole, clinicId: string, appointmentId: string): Promise<ReceptionAppointmentDetailDto> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.QUEUE_VIEW);
    const appointment = await receptionAppointmentsRepository.findByIdForClinic(appointmentId, clinicId);
    if (!appointment) {
      throw new NotFoundError('Appointment');
    }
    return toReceptionAppointmentDetail(appointment, await queuePositionFor(appointment.queueToken));
  },

  async searchPatients(userId: string, role: UserRole, clinicId: string, q: string, page: number, limit: number): Promise<PaginatedResult<PatientSearchResultDto>> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.QUEUE_VIEW);
    const { items, total } = await receptionAppointmentsRepository.searchPatients(clinicId, q, page, limit);
    const mapped: PatientSearchResultDto[] = items.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      age: calculateAge(p.dateOfBirth),
      gender: p.gender,
      phone: p.user.phone,
      profileImageUrl: p.profileImageUrl,
      lastAppointmentAt: p.appointments[0]?.scheduledAt.toISOString() ?? null,
    }));
    return { items: mapped, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },

  async quickView(userId: string, role: UserRole, clinicId: string, patientId: string): Promise<PatientQuickViewDto> {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.QUEUE_VIEW);
    const patient = await receptionAppointmentsRepository.findPatientForClinic(patientId, clinicId);
    if (!patient) {
      throw new NotFoundError('Patient');
    }
    const todayAppointment = patient.appointments[0];

    return {
      id: patient.id,
      fullName: patient.fullName,
      age: calculateAge(patient.dateOfBirth),
      gender: patient.gender,
      phone: patient.user.phone,
      email: patient.user.email,
      profileImageUrl: patient.profileImageUrl,
      todayAppointment: todayAppointment
        ? toReceptionAppointmentSummary({ ...todayAppointment, patient }, await queuePositionFor(todayAppointment.queueToken))
        : null,
    };
  },
};
