import type { Prisma, ReviewStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';

const MODERATION_FEED_CAP = 500;

export const reviewsRepository = {
  findAppointmentForReview(appointmentId: string) {
    return prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { include: { user: true } },
        doctor: true,
        clinic: true,
        consultation: { select: { status: true } },
        doctorReview: { select: { id: true } },
        clinicReview: { select: { id: true } },
      },
    });
  },

  findDoctorReviewByAppointment(appointmentId: string) {
    return prisma.doctorReview.findUnique({ where: { appointmentId } });
  },

  findClinicReviewByAppointment(appointmentId: string) {
    return prisma.clinicReview.findUnique({ where: { appointmentId } });
  },

  createDoctorReview(data: Prisma.DoctorReviewUncheckedCreateInput) {
    return prisma.doctorReview.create({ data });
  },

  createClinicReview(data: Prisma.ClinicReviewUncheckedCreateInput) {
    return prisma.clinicReview.create({ data });
  },

  findDoctorReviewById(id: string) {
    return prisma.doctorReview.findUnique({ where: { id } });
  },

  findClinicReviewById(id: string) {
    return prisma.clinicReview.findUnique({ where: { id } });
  },

  updateDoctorReview(id: string, data: Prisma.DoctorReviewUpdateInput) {
    return prisma.doctorReview.update({ where: { id }, data });
  },

  updateClinicReview(id: string, data: Prisma.ClinicReviewUpdateInput) {
    return prisma.clinicReview.update({ where: { id }, data });
  },

  deleteDoctorReview(id: string) {
    return prisma.doctorReview.delete({ where: { id } });
  },

  deleteClinicReview(id: string) {
    return prisma.clinicReview.delete({ where: { id } });
  },

  async listMyDoctorReviews(patientId: string, page: number, limit: number) {
    const where = { patientId };
    const [total, items] = await Promise.all([
      prisma.doctorReview.count({ where }),
      prisma.doctorReview.findMany({
        where,
        include: { doctor: { select: { id: true, displayName: true } }, appointment: { select: { bookingReference: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { total, items };
  },

  async listMyClinicReviews(patientId: string, page: number, limit: number) {
    const where = { patientId };
    const [total, items] = await Promise.all([
      prisma.clinicReview.count({ where }),
      prisma.clinicReview.findMany({
        where,
        include: { clinic: { select: { id: true, name: true } }, appointment: { select: { bookingReference: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { total, items };
  },

  async listPublicDoctorReviews(doctorId: string, page: number, limit: number) {
    const where = { doctorId, status: 'PUBLISHED' as ReviewStatus };
    const [total, items] = await Promise.all([
      prisma.doctorReview.count({ where }),
      prisma.doctorReview.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);
    return { total, items };
  },

  async listPublicClinicReviews(clinicId: string, page: number, limit: number) {
    const where = { clinicId, status: 'PUBLISHED' as ReviewStatus };
    const [total, items] = await Promise.all([
      prisma.clinicReview.count({ where }),
      prisma.clinicReview.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);
    return { total, items };
  },

  /** Combined moderation feed: DoctorReview rows scoped via their underlying appointment's
   * clinicId (a doctor review has no direct clinicId column), unioned with ClinicReview rows
   * scoped directly. Two filtered queries, each capped at MODERATION_FEED_CAP rows before an
   * in-memory merge/sort/paginate — a pragmatic bound for an admin-only browsing view rather than
   * full cross-table SQL pagination (UNION ALL across two differently-shaped tables); documented
   * as a known limitation for clinics with an exceptionally large review history. */
  async listModerationQueue(filter: {
    clinicId: string;
    type?: 'DOCTOR' | 'CLINIC';
    status?: ReviewStatus;
    rating?: number;
    doctorId?: string;
    from?: Date;
    to?: Date;
    search?: string;
  }) {
    const dateFilter = filter.from || filter.to ? { gte: filter.from, lte: filter.to } : undefined;
    const searchFilter = filter.search ? { contains: filter.search, mode: 'insensitive' as const } : undefined;

    const wantDoctor = !filter.type || filter.type === 'DOCTOR';
    const wantClinic = !filter.type || filter.type === 'CLINIC';

    const [doctorRows, clinicRows] = await Promise.all([
      wantDoctor
        ? prisma.doctorReview.findMany({
            where: {
              appointment: { clinicId: filter.clinicId },
              doctorId: filter.doctorId,
              status: filter.status,
              rating: filter.rating,
              createdAt: dateFilter,
              authorName: searchFilter,
            },
            include: { doctor: { select: { id: true, displayName: true } }, appointment: { select: { clinicId: true } } },
            orderBy: { createdAt: 'desc' },
            take: MODERATION_FEED_CAP,
          })
        : Promise.resolve([]),
      wantClinic
        ? prisma.clinicReview.findMany({
            where: {
              clinicId: filter.clinicId,
              status: filter.status,
              rating: filter.rating,
              createdAt: dateFilter,
              authorName: searchFilter,
            },
            orderBy: { createdAt: 'desc' },
            take: MODERATION_FEED_CAP,
          })
        : Promise.resolve([]),
    ]);

    return { doctorRows, clinicRows };
  },
};
