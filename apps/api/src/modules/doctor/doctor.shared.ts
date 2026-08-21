import { doctorRepository } from './doctor.repository.js';
import { ForbiddenError, NotFoundError } from '../../utils/app-error.js';

/** Shared by `getEarnings` (read-only dashboard) and the Phase 25 settlement-request flow, so
 * both always agree on what a doctor's commission cut is — one source of truth, never duplicated. */
export const PLATFORM_COMMISSION_PERCENT = 10;

/** Every doctor-portal module resolves the acting Doctor row from the authenticated userId —
 * never trusts a client-supplied doctorId. Shared here so sibling doctor-* modules don't
 * duplicate it. */
export async function resolveDoctorOrThrow(userId: string) {
  const doctor = await doctorRepository.findByUserId(userId);
  if (!doctor) {
    throw new NotFoundError('Doctor profile');
  }
  return doctor;
}

/** Guards every clinic-scoped action (schedule, status, queue, delay) so a doctor can only act
 * on clinics they are actively associated with. */
export async function assertClinicMembership(doctorId: string, clinicId: string) {
  const membership = await doctorRepository.findClinicDoctor(doctorId, clinicId);
  if (!membership || !membership.isActive) {
    throw new ForbiddenError('You are not associated with this clinic');
  }
  return membership;
}

/** Phase 25 — the doctor's net earnings not yet covered by any PAID settlement, computed the same
 * way `getEarnings` computes any other range: sum of COMPLETED appointments' consultationFee via
 * `earningsAggregate`, minus the platform commission. `periodStart` is the most recent PAID
 * settlement's `periodEnd`, or the doctor's own account creation date if they've never been paid
 * — never a client-supplied date, so a settlement request can never double-claim or skip earnings. */
export async function resolveUnsettledEarnings(doctorId: string, doctorCreatedAt: Date): Promise<{ periodStart: Date; periodEnd: Date; amount: number }> {
  const lastPaid = await doctorRepository.findLastPaidSettlement(doctorId);
  const periodStart = lastPaid?.periodEnd ?? doctorCreatedAt;
  const periodEnd = new Date();
  const agg = await doctorRepository.earningsAggregate(doctorId, periodStart, periodEnd);
  const total = Number(agg._sum.consultationFee ?? 0);
  const commission = Math.round(((total * PLATFORM_COMMISSION_PERCENT) / 100) * 100) / 100;
  const net = Math.round((total - commission) * 100) / 100;
  return { periodStart, periodEnd, amount: net };
}
