import { bookingEngine } from '../booking/booking.engine.js';
import { bookingRepository } from '../booking/booking.repository.js';
import { paymentEngine } from '../payments/payment.engine.js';
import { prisma } from '../../config/database.js';

const FAR_FUTURE = new Date('2999-12-31T23:59:59.999Z');

/**
 * Clinic-wide sibling of Phase 26's per-doctor `cancelFutureAppointmentsAtClinic`
 * (`clinic-doctors.service.ts`) — a whole clinic going non-operational (self-service
 * CLOSED/TEMPORARILY_CLOSED/SUSPENDED via `clinic.service.ts::updateStatus`, or a platform-admin
 * verification SUSPENSION via `platform-admin.service.ts::updateVerification`) must not leave
 * every doctor's already-booked appointments at this clinic silently active — reuses the exact
 * scan -> atomic per-appointment claim -> `cancelCore` -> refund core Phase 8/26 already
 * established, scoped by `clinicId` alone (every doctor at the clinic, not just one).
 */
export async function cancelFutureAppointmentsForClinic(clinicId: string, actorUserId: string, reason: string): Promise<number> {
  const conflicts = await bookingRepository.findConflictingAppointmentsForClinic(clinicId, new Date(), FAR_FUTURE);

  let cancelledCount = 0;
  for (const appointment of conflicts) {
    const claim = await prisma.appointment.updateMany({
      where: { id: appointment.id, status: { in: ['PENDING', 'CONFIRMED'] } },
      data: { status: 'CANCELLED' },
    });
    if (claim.count !== 1) continue;

    await bookingEngine.cancelCore(appointment, { reason, actorUserId, source: 'RECEPTION' });
    await paymentEngine.handleAppointmentCancelled(appointment.id, actorUserId);
    cancelledCount++;
  }
  return cancelledCount;
}
