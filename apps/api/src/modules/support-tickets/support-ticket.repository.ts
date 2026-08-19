import type { Prisma, SupportTicketCategory, SupportTicketStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';

const rowInclude = {
  raisedBy: { select: { id: true, role: true, email: true, patientProfile: { select: { fullName: true } } } },
  clinic: { select: { id: true, name: true } },
  appointment: { select: { id: true, bookingReference: true } },
} satisfies Prisma.SupportTicketInclude;

const detailInclude = {
  ...rowInclude,
  messages: {
    orderBy: { createdAt: 'asc' },
    include: {
      sender: { select: { id: true, role: true, email: true, patientProfile: { select: { fullName: true } } } },
    },
  },
} satisfies Prisma.SupportTicketInclude;

export type SupportTicketRowWithRelations = Prisma.SupportTicketGetPayload<{ include: typeof rowInclude }>;
export type SupportTicketDetailWithRelations = Prisma.SupportTicketGetPayload<{ include: typeof detailInclude }>;

export const supportTicketRepository = {
  create(data: {
    ticketNumber: string;
    raisedByUserId: string;
    clinicId: string | null;
    appointmentId: string | null;
    paymentId: string | null;
    category: SupportTicketCategory;
    subject: string;
    description: string;
  }) {
    return prisma.supportTicket.create({ data, include: detailInclude });
  },

  findDetailById(id: string) {
    return prisma.supportTicket.findUnique({ where: { id }, include: detailInclude });
  },

  async listForUser(raisedByUserId: string, filters: { status?: SupportTicketStatus; page: number; limit: number }) {
    const where: Prisma.SupportTicketWhereInput = { raisedByUserId, status: filters.status };
    const [items, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: rowInclude,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.supportTicket.count({ where }),
    ]);
    return { items, total };
  },

  async listForAdmin(filters: {
    status?: SupportTicketStatus;
    category?: SupportTicketCategory;
    clinicId?: string;
    search?: string;
    page: number;
    limit: number;
  }) {
    const where: Prisma.SupportTicketWhereInput = {
      status: filters.status,
      category: filters.category,
      clinicId: filters.clinicId,
      ...(filters.search
        ? { OR: [{ ticketNumber: { contains: filters.search, mode: 'insensitive' } }, { subject: { contains: filters.search, mode: 'insensitive' } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: rowInclude,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.supportTicket.count({ where }),
    ]);
    return { items, total };
  },

  updateStatus(
    id: string,
    data: { status: SupportTicketStatus; resolutionNotes?: string | null; resolvedAt?: Date | null; resolvedByUserId?: string | null; closedAt?: Date | null },
  ) {
    return prisma.supportTicket.update({ where: { id }, data, include: detailInclude });
  },

  addMessage(ticketId: string, senderUserId: string, message: string) {
    return prisma.supportTicketMessage.create({
      data: { ticketId, senderUserId, message },
      include: { sender: { select: { id: true, role: true, email: true, patientProfile: { select: { fullName: true } } } } },
    });
  },

  /** Ownership-checked lookup used to derive `clinicId` server-side when a ticket is linked to an
   * appointment — the client's appointmentId is trusted only as far as "does this appointment
   * belong to the calling patient", never for the clinicId it carries being taken at face value
   * without this check. */
  findOwnedAppointment(appointmentId: string, patientId: string) {
    return prisma.appointment.findFirst({ where: { id: appointmentId, patientId }, select: { id: true, clinicId: true, bookingReference: true } });
  },

  findOwnedPayment(paymentId: string, patientId: string) {
    return prisma.payment.findFirst({ where: { id: paymentId, patientId }, select: { id: true, clinicId: true } });
  },
};
