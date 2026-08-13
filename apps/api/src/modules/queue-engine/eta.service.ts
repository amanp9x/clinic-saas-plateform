import type { DoctorSessionStatus, QueueStatus } from '@prisma/client';

const DEFAULT_CONSULTATION_MINUTES = 15;

export interface EtaInput {
  /** null when the subject token/patient isn't in a countable waiting position (e.g. already called). */
  patientsAhead: number | null;
  avgConsultationMinutes: number | null;
  delayMinutes: number | null;
  queueStatus: QueueStatus | null;
  doctorStatus: DoctorSessionStatus | null;
}

/**
 * Single deterministic ETA formula — no AI/prediction, reused by every portal (patient queue
 * view, doctor queue, reception console) so no caller ever recomputes this on the frontend.
 */
export function calculateEta(input: EtaInput): number | null {
  if (input.patientsAhead == null) return null;
  if (input.queueStatus === 'PAUSED' || input.queueStatus === 'CLOSED') return null;
  if (input.doctorStatus === 'UNAVAILABLE' || input.doctorStatus === 'SESSION_ENDED') return null;

  const perPatientMinutes = input.avgConsultationMinutes ?? DEFAULT_CONSULTATION_MINUTES;
  const queueMinutes = input.patientsAhead * perPatientMinutes;
  const delay = input.delayMinutes ?? 0;
  return Math.max(0, queueMinutes + delay);
}
