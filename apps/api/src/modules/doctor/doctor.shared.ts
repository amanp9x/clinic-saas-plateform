import { doctorRepository } from './doctor.repository.js';
import { ForbiddenError, NotFoundError } from '../../utils/app-error.js';

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
