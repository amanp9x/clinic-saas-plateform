import { CLINIC_PERMISSIONS, SOCKET_EVENTS, type UserRole } from '@clinic/shared';
import type { ClinicDoctorAssociateInput, ClinicDoctorStatusUpdateInput, ClinicDoctorUpdateInput } from '@clinic/shared';
import { clinicDoctorsRepository } from './clinic-doctors.repository.js';
import { toClinicDoctorDetail, toClinicDoctorSummary, toExistingDoctorSearchResult } from './clinic-doctors.mappers.js';
import { assertClinicPermission } from '../reception/reception.shared.js';
import { queueRepository } from '../doctor-queue/queue.repository.js';
import { prisma } from '../../config/database.js';
import { ConflictError, NotFoundError } from '../../utils/app-error.js';
import { recordAuditLog } from '../../utils/audit-log.js';
import { emitToClinicRoom } from '../../sockets/emit.js';

async function sessionFor(doctorId: string, clinicId: string) {
  const session = await queueRepository.findSession(doctorId, clinicId);
  return session ? { status: session.status, queueStatus: session.queueStatus } : null;
}

export const clinicDoctorsService = {
  async searchExistingDoctors(userId: string, role: UserRole, clinicId: string, q: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.DOCTOR_MANAGE);
    const doctors = await clinicDoctorsRepository.searchDoctors(q);
    const associations = await prisma.clinicDoctor.findMany({ where: { clinicId, doctorId: { in: doctors.map((d) => d.id) } }, select: { doctorId: true } });
    const associatedIds = new Set(associations.map((a) => a.doctorId));
    return doctors.map((d) => toExistingDoctorSearchResult(d, associatedIds.has(d.id)));
  },

  async list(userId: string, role: UserRole, clinicId: string, q: string | undefined, page: number, limit: number) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.DOCTOR_VIEW);
    const { items, total } = await clinicDoctorsRepository.list(clinicId, q, page, limit);
    const mapped = await Promise.all(items.map(async (a) => toClinicDoctorSummary(a, await sessionFor(a.doctorId, clinicId))));
    return { items: mapped, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },

  async getById(userId: string, role: UserRole, clinicId: string, clinicDoctorId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.DOCTOR_VIEW);
    const assoc = await clinicDoctorsRepository.findAssociationById(clinicDoctorId, clinicId);
    if (!assoc) throw new NotFoundError('Doctor association');
    return toClinicDoctorDetail(assoc, await sessionFor(assoc.doctorId, clinicId));
  },

  async associate(userId: string, role: UserRole, clinicId: string, input: ClinicDoctorAssociateInput) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.DOCTOR_MANAGE);

    const doctor = await prisma.doctor.findUnique({ where: { id: input.doctorId } });
    if (!doctor) throw new NotFoundError('Doctor');

    const existing = await clinicDoctorsRepository.findAssociation(clinicId, input.doctorId);
    if (existing) {
      throw new ConflictError('This doctor is already associated with this clinic');
    }

    const created = await clinicDoctorsRepository.create({
      clinicId,
      doctorId: input.doctorId,
      departmentId: input.departmentId ?? undefined,
      consultationFeeOverride: input.consultationFeeOverride ?? undefined,
      consultationDurationMinutesOverride: input.consultationDurationMinutesOverride ?? undefined,
      consultationTypes: input.consultationTypes,
      timings: input.timings ?? undefined,
      availableDays: input.availableDays ?? [],
      startDate: input.startDate ? new Date(input.startDate) : undefined,
    });

    recordAuditLog({ actorUserId: userId, action: 'clinic.doctor_associated', entityType: 'ClinicDoctor', entityId: created.id, clinicId, metadata: { doctorId: input.doctorId } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.DOCTOR_ASSOCIATION.UPDATED, { clinicId, doctorId: input.doctorId });
    return toClinicDoctorDetail(created, null);
  },

  async update(userId: string, role: UserRole, clinicId: string, clinicDoctorId: string, input: ClinicDoctorUpdateInput) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.DOCTOR_MANAGE);
    const assoc = await clinicDoctorsRepository.findAssociationById(clinicDoctorId, clinicId);
    if (!assoc) throw new NotFoundError('Doctor association');

    const updated = await clinicDoctorsRepository.update(clinicDoctorId, {
      department: input.departmentId !== undefined ? (input.departmentId ? { connect: { id: input.departmentId } } : { disconnect: true }) : undefined,
      consultationFeeOverride: input.consultationFeeOverride,
      consultationDurationMinutesOverride: input.consultationDurationMinutesOverride,
      consultationTypes: input.consultationTypes,
      timings: input.timings,
      availableDays: input.availableDays,
      isAcceptingAppointments: input.isAcceptingAppointments,
      queueEnabled: input.queueEnabled,
      canOverrideDelay: input.canOverrideDelay,
      startDate: input.startDate !== undefined ? (input.startDate ? new Date(input.startDate) : null) : undefined,
      endDate: input.endDate !== undefined ? (input.endDate ? new Date(input.endDate) : null) : undefined,
    });

    recordAuditLog({ actorUserId: userId, action: 'clinic.doctor_association_updated', entityType: 'ClinicDoctor', entityId: clinicDoctorId, clinicId, metadata: { fields: Object.keys(input) } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.DOCTOR_ASSOCIATION.UPDATED, { clinicId, doctorId: assoc.doctorId });
    return toClinicDoctorDetail(updated, await sessionFor(assoc.doctorId, clinicId));
  },

  async updateStatus(userId: string, role: UserRole, clinicId: string, clinicDoctorId: string, input: ClinicDoctorStatusUpdateInput) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.DOCTOR_MANAGE);
    const assoc = await clinicDoctorsRepository.findAssociationById(clinicDoctorId, clinicId);
    if (!assoc) throw new NotFoundError('Doctor association');

    const updated = await clinicDoctorsRepository.update(clinicDoctorId, {
      status: input.status,
      isActive: input.status === 'ACTIVE',
    });

    recordAuditLog({
      actorUserId: userId,
      action: 'clinic.doctor_status_updated',
      entityType: 'ClinicDoctor',
      entityId: clinicDoctorId,
      clinicId,
      metadata: { previousState: { status: assoc.status }, newState: { status: input.status } },
    });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.DOCTOR_ASSOCIATION.UPDATED, { clinicId, doctorId: assoc.doctorId });
    return toClinicDoctorDetail(updated, await sessionFor(assoc.doctorId, clinicId));
  },

  async remove(userId: string, role: UserRole, clinicId: string, clinicDoctorId: string) {
    await assertClinicPermission(userId, role, clinicId, CLINIC_PERMISSIONS.DOCTOR_MANAGE);
    const assoc = await clinicDoctorsRepository.findAssociationById(clinicDoctorId, clinicId);
    if (!assoc) throw new NotFoundError('Doctor association');

    await clinicDoctorsRepository.remove(clinicDoctorId);

    recordAuditLog({ actorUserId: userId, action: 'clinic.doctor_association_removed', entityType: 'ClinicDoctor', entityId: clinicDoctorId, clinicId, metadata: { doctorId: assoc.doctorId } });
    emitToClinicRoom(clinicId, SOCKET_EVENTS.DOCTOR_ASSOCIATION.UPDATED, { clinicId, doctorId: assoc.doctorId });
  },
};
