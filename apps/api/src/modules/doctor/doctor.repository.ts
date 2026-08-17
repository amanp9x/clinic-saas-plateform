import { AppointmentStatus, DoctorSessionStatus, type Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { startOfDay } from '../../utils/date.js';

export const doctorRepository = {
  findByUserId(userId: string) {
    return prisma.doctor.findUnique({
      where: { userId },
      include: { user: true, specialization: true },
    });
  },

  updateProfile(doctorId: string, data: Prisma.DoctorUpdateInput) {
    return prisma.doctor.update({
      where: { id: doctorId },
      data,
      include: { user: true, specialization: true },
    });
  },

  updateProfileImage(doctorId: string, profileImageUrl: string | null) {
    return prisma.doctor.update({ where: { id: doctorId }, data: { profileImageUrl } });
  },

  listClinics(doctorId: string) {
    return prisma.clinicDoctor.findMany({
      where: { doctorId },
      include: { clinic: true },
      orderBy: { createdAt: 'asc' },
    });
  },

  findClinicDoctor(doctorId: string, clinicId: string) {
    return prisma.clinicDoctor.findUnique({
      where: { clinicId_doctorId: { clinicId, doctorId } },
      include: { clinic: true },
    });
  },

  updateClinicAssociation(clinicDoctorId: string, data: Prisma.ClinicDoctorUpdateInput) {
    return prisma.clinicDoctor.update({ where: { id: clinicDoctorId }, data, include: { clinic: true } });
  },

  listAvailability(doctorId: string) {
    return prisma.doctorAvailability.findMany({
      where: { clinicDoctor: { doctorId } },
      include: { clinicDoctor: { include: { clinic: true } } },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });
  },

  findAvailability(id: string, doctorId: string) {
    return prisma.doctorAvailability.findFirst({
      where: { id, clinicDoctor: { doctorId } },
      include: { clinicDoctor: { include: { clinic: true } } },
    });
  },

  createAvailability(
    clinicDoctorId: string,
    data: Omit<Prisma.DoctorAvailabilityUncheckedCreateInput, 'clinicDoctorId'>,
  ) {
    return prisma.doctorAvailability.create({
      data: { ...data, clinicDoctorId },
      include: { clinicDoctor: { include: { clinic: true } } },
    });
  },

  updateAvailability(id: string, data: Prisma.DoctorAvailabilityUpdateInput) {
    return prisma.doctorAvailability.update({
      where: { id },
      data,
      include: { clinicDoctor: { include: { clinic: true } } },
    });
  },

  deleteAvailability(id: string) {
    return prisma.doctorAvailability.delete({ where: { id } });
  },

  listLeaves(doctorId: string) {
    return prisma.doctorLeave.findMany({
      where: { doctorId },
      include: { clinic: true },
      orderBy: { startDate: 'asc' },
    });
  },

  findLeave(id: string, doctorId: string) {
    return prisma.doctorLeave.findFirst({ where: { id, doctorId }, include: { clinic: true } });
  },

  createLeave(doctorId: string, data: Omit<Prisma.DoctorLeaveUncheckedCreateInput, 'doctorId'>) {
    return prisma.doctorLeave.create({ data: { ...data, doctorId }, include: { clinic: true } });
  },

  deleteLeave(id: string) {
    return prisma.doctorLeave.delete({ where: { id } });
  },

  findSession(doctorId: string, clinicId: string, sessionDate: Date = startOfDay()) {
    return prisma.doctorSession.findUnique({
      where: { doctorId_clinicId_sessionDate: { doctorId, clinicId, sessionDate } },
      include: { clinic: true },
    });
  },

  listTodaySessions(doctorId: string) {
    return prisma.doctorSession.findMany({
      where: { doctorId, sessionDate: startOfDay() },
      include: {
        clinic: true,
        tokens: { where: { status: 'WAITING' }, select: { id: true } },
      },
    });
  },

  upsertManualStatus(doctorId: string, clinicId: string, status: DoctorSessionStatus) {
    const sessionDate = startOfDay();
    return prisma.doctorSession.upsert({
      where: { doctorId_clinicId_sessionDate: { doctorId, clinicId, sessionDate } },
      update: { status },
      create: { doctorId, clinicId, sessionDate, status },
      include: { clinic: true },
    });
  },

  listReviews(doctorId: string, limit?: number) {
    return prisma.doctorReview.findMany({
      where: { doctorId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  findReview(id: string, doctorId: string) {
    return prisma.doctorReview.findFirst({ where: { id, doctorId }, include: { patient: { select: { userId: true } } } });
  },

  respondToReview(id: string, response: string, respondedByUserId: string) {
    return prisma.doctorReview.update({ where: { id }, data: { response, respondedAt: new Date(), respondedByUserId } });
  },

  earningsAggregate(doctorId: string, from: Date, to: Date) {
    return prisma.appointment.aggregate({
      where: { doctorId, status: AppointmentStatus.COMPLETED, completedAt: { gte: from, lte: to } },
      _sum: { consultationFee: true },
      _count: { _all: true },
    });
  },

  countTodayAppointments(doctorId: string) {
    return prisma.appointment.count({
      where: {
        doctorId,
        scheduledAt: { gte: startOfDay(), lte: new Date(startOfDay().getTime() + 24 * 60 * 60 * 1000 - 1) },
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
      },
    });
  },

  countUpcomingAppointments(doctorId: string) {
    return prisma.appointment.count({
      where: {
        doctorId,
        scheduledAt: { gt: new Date(startOfDay().getTime() + 24 * 60 * 60 * 1000 - 1) },
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW, AppointmentStatus.COMPLETED] },
      },
    });
  },

  countTodayCompletedConsultations(doctorId: string) {
    return prisma.consultation.count({
      where: { doctorId, status: 'COMPLETED', completedAt: { gte: startOfDay() } },
    });
  },

  countTodayPendingConsultations(doctorId: string) {
    return prisma.appointment.count({
      where: {
        doctorId,
        scheduledAt: { gte: startOfDay(), lte: new Date(startOfDay().getTime() + 24 * 60 * 60 * 1000 - 1) },
        status: { in: [AppointmentStatus.CONFIRMED, AppointmentStatus.CHECKED_IN, AppointmentStatus.IN_CONSULTATION] },
      },
    });
  },

  countTodayDistinctPatients(doctorId: string) {
    return prisma.appointment
      .findMany({
        where: {
          doctorId,
          scheduledAt: { gte: startOfDay(), lte: new Date(startOfDay().getTime() + 24 * 60 * 60 * 1000 - 1) },
          status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW] },
        },
        select: { patientId: true },
        distinct: ['patientId'],
      })
      .then((rows) => rows.length);
  },

  findNextAppointment(doctorId: string) {
    return prisma.appointment.findFirst({
      where: {
        doctorId,
        scheduledAt: { gte: new Date() },
        status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW, AppointmentStatus.COMPLETED] },
      },
      include: { patient: true, clinic: true, prescriptions: { select: { id: true } } },
      orderBy: { scheduledAt: 'asc' },
    });
  },
};
