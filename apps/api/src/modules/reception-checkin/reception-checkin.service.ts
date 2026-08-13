import { CLINIC_PERMISSIONS, type UserRole } from '@clinic/shared';
import type { CheckInInput, WalkInCreateInput } from '@clinic/shared';
import { queueEngine } from '../queue-engine/queue-engine.service.js';
import { assertClinicPermission, requireDoctorAtClinic } from '../reception/reception.shared.js';
import { toTokenDto } from '../doctor-queue/queue.mappers.js';
import { prisma } from '../../config/database.js';
import { NotFoundError } from '../../utils/app-error.js';

export const receptionCheckinService = {
  async checkIn(userId: string, role: UserRole, input: CheckInInput) {
    const appointment = await prisma.appointment.findUnique({ where: { id: input.appointmentId } });
    if (!appointment) {
      throw new NotFoundError('Appointment');
    }
    await assertClinicPermission(userId, role, appointment.clinicId, CLINIC_PERMISSIONS.PATIENT_CHECKIN);

    const { token } = await queueEngine.checkIn(userId, input.appointmentId);
    return toTokenDto(token);
  },

  async registerWalkIn(userId: string, role: UserRole, input: WalkInCreateInput) {
    await assertClinicPermission(userId, role, input.clinicId, CLINIC_PERMISSIONS.PATIENT_WALKIN_CREATE);
    await requireDoctorAtClinic(input.doctorId, input.clinicId);

    const { appointment, token } = await queueEngine.registerWalkIn(userId, {
      clinicId: input.clinicId,
      doctorId: input.doctorId,
      existingPatientId: input.existingPatientId,
      fullName: input.fullName,
      phone: input.phone,
      age: input.age,
      gender: input.gender,
      reasonForVisit: input.reasonForVisit,
      paymentStatus: input.paymentStatus,
      priority: input.priority,
    });
    return { appointmentId: appointment.id, token: toTokenDto(token) };
  },
};
