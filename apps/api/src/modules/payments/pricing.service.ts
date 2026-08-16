import { prisma } from '../../config/database.js';
import { resolveFeeForDoctorClinic } from '../booking/booking.engine.js';

export interface PriceBreakdown {
  subtotal: number;
  discount: number;
  tax: number;
  amount: number;
  currency: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The single, centralized place price is computed server-side — never trust a frontend-supplied
 * amount (see payment.engine.ts's `createOrder`, which is the only caller). ClinicSettings-driven
 * inputs (service fee, tax) are read fresh on every call, but the *result* is immediately
 * snapshotted onto the Payment row by the caller, so a later ClinicSettings change never
 * retroactively changes an already-created payment/invoice — same convention as
 * Appointment.consultationFee's own snapshot.
 */
export async function calculatePrice(doctorId: string, clinicId: string): Promise<PriceBreakdown> {
  const [fee, settings] = await Promise.all([
    resolveFeeForDoctorClinic(doctorId, clinicId),
    prisma.clinicSettings.findUnique({ where: { clinicId } }),
  ]);

  const consultationFee = fee ?? 0;
  const serviceFee = settings?.serviceFeeFlat ? Number(settings.serviceFeeFlat) : 0;
  const taxPercent = settings?.taxPercent ? Number(settings.taxPercent) : 0;
  const currency = settings?.currency ?? 'INR';

  const subtotal = round2(consultationFee + serviceFee);
  const discount = 0; // No discount-code system exists in this codebase yet — structurally present for future use.
  const tax = round2((subtotal - discount) * (taxPercent / 100));
  const amount = round2(subtotal - discount + tax);

  return { subtotal, discount, tax, amount, currency };
}
