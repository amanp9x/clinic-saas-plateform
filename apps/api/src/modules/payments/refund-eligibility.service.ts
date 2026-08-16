import { prisma } from '../../config/database.js';

export interface RefundEligibility {
  eligiblePercent: number;
  eligibleAmount: number;
}

/**
 * Centralized refund-eligibility rule — the one place cancellation policy translates into a
 * refundable amount. Deliberately kept to a single flat percentage
 * (`ClinicSettings.refundOnCancellationPercent`, default 100) rather than parsing the free-text
 * `cancellationPolicy` field (display copy, not machine-readable) or hardcoding tiered
 * time-before-appointment rules that no existing schema field supports. Any future richer policy
 * (e.g. tiered by hours-before-appointment) should be added here, not at each call site.
 */
export async function calculateRefundEligibility(clinicId: string, capturedAmount: number): Promise<RefundEligibility> {
  const settings = await prisma.clinicSettings.findUnique({ where: { clinicId } });
  const eligiblePercent = settings?.refundOnCancellationPercent ?? 100;
  const eligibleAmount = Math.round(capturedAmount * (eligiblePercent / 100) * 100) / 100;
  return { eligiblePercent, eligibleAmount };
}
