import type { Prisma, PaymentAttemptStatus, PaymentMethod, PaymentProvider, PaymentTransactionStatus, RefundStatus } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { isUniqueConstraintError } from '../doctor-queue/queue.repository.js';

export const paymentDetailInclude = {
  appointment: { include: { doctor: true, clinic: true, patient: { include: { user: true } } } },
  attempts: { orderBy: { attemptNumber: 'desc' } },
  refunds: { orderBy: { createdAt: 'desc' } },
  invoice: true,
} satisfies Prisma.PaymentInclude;

export type PaymentWithRelations = Prisma.PaymentGetPayload<{ include: typeof paymentDetailInclude }>;

export const paymentRepository = {
  createPayment(data: {
    appointmentId: string;
    patientId: string;
    doctorId: string;
    clinicId: string;
    provider: PaymentProvider;
    subtotal: number;
    discount: number;
    tax: number;
    amount: number;
    currency: string;
    expiresAt: Date;
  }) {
    return prisma.payment.create({ data, include: paymentDetailInclude });
  },

  findById(id: string) {
    return prisma.payment.findUnique({ where: { id }, include: paymentDetailInclude });
  },

  findByAppointmentId(appointmentId: string) {
    return prisma.payment.findUnique({ where: { appointmentId }, include: paymentDetailInclude });
  },

  updateStatus(id: string, data: Partial<{
    status: PaymentTransactionStatus;
    method: PaymentMethod | null;
    providerOrderId: string | null;
    providerPaymentId: string | null;
    capturedAmount: number | null;
    refundedAmount: number;
    capturedAt: Date | null;
    cancelledAt: Date | null;
    expiresAt: Date;
  }>) {
    return prisma.payment.update({ where: { id }, data, include: paymentDetailInclude });
  },

  createAttempt(data: {
    paymentId: string;
    attemptNumber: number;
    provider: PaymentProvider;
    providerOrderId: string;
    amount: number;
    currency: string;
  }) {
    return prisma.paymentAttempt.create({ data });
  },

  updateAttempt(id: string, data: Partial<{
    status: PaymentAttemptStatus;
    providerPaymentId: string | null;
    method: PaymentMethod | null;
    failureCode: string | null;
    failureMessage: string | null;
  }>) {
    return prisma.paymentAttempt.update({ where: { id }, data });
  },

  findAttemptByProviderOrderId(provider: PaymentProvider, providerOrderId: string) {
    return prisma.paymentAttempt.findUnique({ where: { provider_providerOrderId: { provider, providerOrderId } } });
  },

  countAttempts(paymentId: string) {
    return prisma.paymentAttempt.count({ where: { paymentId } });
  },

  /** Returns null on a duplicate (provider, providerEventId) — the idempotency guarantee for
   * webhook processing lives in this unique constraint, not application-level deduplication. */
  async createWebhookEvent(data: { provider: PaymentProvider; providerEventId: string; eventType: string; paymentId: string | null; payload: object }) {
    try {
      return await prisma.paymentWebhookEvent.create({ data });
    } catch (err) {
      if (isUniqueConstraintError(err)) return null;
      throw err;
    }
  },

  markWebhookProcessed(id: string) {
    return prisma.paymentWebhookEvent.update({ where: { id }, data: { processedAt: new Date() } });
  },

  createInvoice(data: {
    invoiceNumber: string;
    paymentId: string;
    appointmentId: string;
    patientId: string;
    doctorId: string;
    clinicId: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    currency: string;
    status: PaymentTransactionStatus;
    method: PaymentMethod | null;
  }) {
    return prisma.invoice.create({ data });
  },

  findInvoiceByPaymentId(paymentId: string) {
    return prisma.invoice.findUnique({ where: { paymentId } });
  },

  createRefund(data: { paymentId: string; amount: number; reason: string; actorUserId: string }) {
    return prisma.refund.create({ data });
  },

  updateRefund(id: string, data: Partial<{ status: RefundStatus; providerRefundId: string | null; failureMessage: string | null }>) {
    return prisma.refund.update({ where: { id }, data });
  },

  async listForPatient(patientId: string, page: number, limit: number) {
    const where: Prisma.PaymentWhereInput = { patientId };
    const [items, total] = await Promise.all([
      prisma.payment.findMany({ where, include: paymentDetailInclude, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.payment.count({ where }),
    ]);
    return { items, total };
  },

  async listForClinicBilling(filters: {
    clinicId: string;
    doctorId?: string;
    patientId?: string;
    status?: PaymentTransactionStatus;
    method?: PaymentMethod;
    from?: Date;
    to?: Date;
    page: number;
    limit: number;
  }) {
    const where: Prisma.PaymentWhereInput = {
      clinicId: filters.clinicId,
      ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
      ...(filters.patientId ? { patientId: filters.patientId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.method ? { method: filters.method } : {}),
      ...(filters.from || filters.to
        ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: paymentDetailInclude,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.payment.count({ where }),
    ]);
    return { items, total };
  },

  async clinicBillingTotals(clinicId: string) {
    const [captured, pending, refunded] = await Promise.all([
      prisma.payment.aggregate({ where: { clinicId, status: { in: ['CAPTURED', 'PARTIALLY_REFUNDED'] } }, _sum: { amount: true }, _count: true }),
      prisma.payment.aggregate({ where: { clinicId, status: { in: ['CREATED', 'PENDING', 'AUTHORIZED'] } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { clinicId, status: { in: ['REFUNDED', 'PARTIALLY_REFUNDED'] } }, _sum: { refundedAmount: true }, _count: true }),
    ]);
    const failedCount = await prisma.payment.count({ where: { clinicId, status: 'FAILED' } });
    return {
      totalCollected: Number(captured._sum.amount ?? 0),
      pendingAmount: Number(pending._sum.amount ?? 0),
      refundedAmount: Number(refunded._sum.refundedAmount ?? 0),
      successfulCount: captured._count,
      failedCount,
      refundedCount: refunded._count,
    };
  },
};
