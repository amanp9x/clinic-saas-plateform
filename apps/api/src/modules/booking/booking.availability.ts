import type { ConsultationType } from '@prisma/client';
import { requireDoctorAtClinic } from '../reception/reception.shared.js';
import { bookingRepository } from './booking.repository.js';
import { resolveConsultationDuration } from './booking-duration.util.js';
import { weekdayForDate } from '../../utils/weekday.js';
import { timeMinutes } from '../../utils/time.util.js';
import { ConflictError } from '../../utils/app-error.js';

export type SlotStatus = 'AVAILABLE' | 'HELD' | 'BOOKED' | 'BLOCKED';

export interface GeneratedSlot {
  startAt: Date;
  endAt: Date;
  status: SlotStatus;
  consultationType: ConsultationType;
  durationMinutes: number;
  feeRupees: number | null;
}

export type SlotClosedReason =
  | 'DOCTOR_NOT_ACCEPTING'
  | 'CLINIC_CLOSED'
  | 'CLINIC_HOLIDAY'
  | 'DOCTOR_ON_LEAVE'
  | 'NO_SESSIONS_TODAY'
  | 'CLINIC_SUSPENDED';

export interface AvailabilityResult {
  slots: GeneratedSlot[];
  closedReason: SlotClosedReason | null;
  doctor: { id: string; displayName: string; profileImageUrl: string | null };
  clinic: { id: string; name: string };
}

function minutesToDate(dayStart: Date, minutes: number): Date {
  return new Date(dayStart.getTime() + minutes * 60_000);
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Centralized slot-generation service — the single source of truth for appointment-slot
 * availability. Combines DoctorAvailability + ClinicWorkingHours + DoctorLeave + ClinicHoliday +
 * duration/buffer resolution + existing Appointments + active SlotHolds + BlockedSlots. Never
 * queries Patient — structurally cannot leak patient data.
 *
 * Timezone note: this codebase has no timezone-aware date math anywhere (Phases 1–7) — server-
 * local time is treated as clinic-local time throughout, exactly like `parseTimeString`,
 * `availability.util.ts`, clinic-schedule, and clinic-holidays already do. This is an inherited
 * limitation, not a Phase 8 regression; `Clinic.timezone` remains display-only/unused.
 */
export async function generateAvailableSlots(params: {
  doctorId: string;
  clinicId: string;
  date: string; // YYYY-MM-DD, server-local/clinic-local per the note above
  consultationType?: ConsultationType;
}): Promise<AvailabilityResult> {
  const clinicDoctor = await requireDoctorAtClinic(params.doctorId, params.clinicId);
  const doctorSummary = {
    id: clinicDoctor.doctor.id,
    displayName: clinicDoctor.doctor.displayName,
    profileImageUrl: clinicDoctor.doctor.profileImageUrl,
  };
  const clinicSummary = { id: clinicDoctor.clinic.id, name: clinicDoctor.clinic.name };

  const empty = (closedReason: SlotClosedReason): AvailabilityResult => ({
    slots: [],
    closedReason,
    doctor: doctorSummary,
    clinic: clinicSummary,
  });

  // Phase 27 — the clinic itself (not just this one doctor association) may be non-operational:
  // self-service CLOSED/TEMPORARILY_CLOSED/SUSPENDED, or a platform-admin verification suspension.
  // Distinct from `CLINIC_CLOSED` below, which means "closed per today's weekly working-hours
  // schedule" — a different, narrower cause.
  if (clinicDoctor.clinic.status !== 'OPEN' || clinicDoctor.clinic.verificationStatus === 'SUSPENDED') {
    return empty('CLINIC_SUSPENDED');
  }

  if (
    !clinicDoctor.isActive ||
    clinicDoctor.status !== 'ACTIVE' ||
    !clinicDoctor.isAcceptingAppointments
  ) {
    return empty('DOCTOR_NOT_ACCEPTING');
  }

  if (params.consultationType && !clinicDoctor.consultationTypes.includes(params.consultationType)) {
    throw new ConflictError(`This doctor does not offer ${params.consultationType} consultations at this clinic`);
  }

  const [y, m, d] = params.date.split('-').map(Number);
  const dayStart = new Date(y!, m! - 1, d!, 0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const weekday = weekdayForDate(dayStart);
  // Both sides constructed from local calendar components (not mixed with UTC-anchored dates) —
  // this is a plain instant comparison of "local midnight of the requested day" vs. "local
  // midnight of today", consistent with the server-local-as-clinic-local convention.
  const now = new Date();
  const todayLocalStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const isToday = dayStart.getTime() === todayLocalStart.getTime();
  const nowMinutesOfDay = isToday ? (now.getTime() - dayStart.getTime()) / 60_000 : -1;

  const workingHours = await bookingRepository.findClinicWorkingHours(params.clinicId, weekday);
  if (!workingHours || !workingHours.isOpen || workingHours.sessions.length === 0) {
    return empty('CLINIC_CLOSED');
  }

  // Holiday matching uses the same UTC-date-key convention as `computeNextAvailableSession` —
  // ClinicHoliday.date is a @db.Date column, compared as a UTC-midnight value.
  const holidayDateKey = new Date(Date.UTC(y!, m! - 1, d!));
  const holiday = await bookingRepository.findClinicHoliday(params.clinicId, holidayDateKey);
  if (holiday?.isFullDay) {
    return empty('CLINIC_HOLIDAY');
  }

  const leaves = await bookingRepository.findDoctorLeaves(params.doctorId, params.clinicId, holidayDateKey);
  if (leaves.length > 0) {
    return empty('DOCTOR_ON_LEAVE');
  }

  const templates = await bookingRepository.findAvailabilityTemplates(clinicDoctor.id, weekday);
  if (templates.length === 0) {
    return empty('NO_SESSIONS_TODAY');
  }

  const settings = await bookingRepository.findClinicSettings(params.clinicId);
  const bufferMinutes = settings?.bufferMinutes ?? 0;
  const clinicDefaultMinutes = settings?.defaultConsultationDurationMinutes ?? 15;

  const [existingAppointments, activeHolds, activeBlocks] = await Promise.all([
    bookingRepository.findExistingAppointmentsForDay(params.doctorId, params.clinicId, dayStart, dayEnd),
    bookingRepository.findActiveHoldsForDay(params.doctorId, params.clinicId, dayStart, dayEnd),
    bookingRepository.findActiveBlocksForRange(params.doctorId, params.clinicId, dayStart, dayEnd),
  ]);

  const heldMinutesOfDay = new Set(activeHolds.map((h) => (h.scheduledAt.getTime() - dayStart.getTime()) / 60_000));

  const workingWindows = workingHours.sessions.map((s) => ({
    start: timeMinutes(s.startTime),
    end: timeMinutes(s.endTime),
  }));

  const holidayWindow =
    holiday && !holiday.isFullDay && holiday.startTime && holiday.endTime
      ? { start: timeMinutes(holiday.startTime), end: timeMinutes(holiday.endTime) }
      : null;

  const feeRupees = (() => {
    const value = clinicDoctor.consultationFeeOverride ?? clinicDoctor.doctor.consultationFee;
    return value ? Number(value) : null;
  })();

  const slots: GeneratedSlot[] = [];

  for (const session of templates) {
    const durationMinutes = resolveConsultationDuration({
      sessionDurationMinutes: session.consultationDurationMinutes,
      clinicDoctorOverrideMinutes: clinicDoctor.consultationDurationMinutesOverride,
      clinicDefaultMinutes,
    });
    const step = durationMinutes + bufferMinutes;
    const sessionStart = timeMinutes(session.startTime);
    const sessionEnd = timeMinutes(session.endTime);
    const breakStart = session.breakStartTime ? timeMinutes(session.breakStartTime) : null;
    const breakEnd = session.breakEndTime ? timeMinutes(session.breakEndTime) : null;

    for (let t = sessionStart; t + durationMinutes <= sessionEnd; t += step) {
      const slotEnd = t + durationMinutes;

      if (breakStart !== null && breakEnd !== null && rangesOverlap(t, slotEnd, breakStart, breakEnd)) continue;
      if (holidayWindow && rangesOverlap(t, slotEnd, holidayWindow.start, holidayWindow.end)) continue;
      if (!workingWindows.some((w) => t >= w.start && slotEnd <= w.end)) continue;
      if (isToday && t < nowMinutesOfDay) continue;

      const startAt = minutesToDate(dayStart, t);
      const endAt = minutesToDate(dayStart, slotEnd);

      // Re-applied symmetrically at read time (not just baked into the grid step) so a later
      // change to ClinicSettings.bufferMinutes doesn't silently misjudge appointments booked on
      // an older grid.
      const isBooked = existingAppointments.some((a) => {
        const aStart = (a.scheduledAt.getTime() - dayStart.getTime()) / 60_000;
        const aDuration = a.durationMinutes ?? durationMinutes;
        return rangesOverlap(t - bufferMinutes, slotEnd + bufferMinutes, aStart, aStart + aDuration);
      });
      const isBlocked = activeBlocks.some((b) => rangesOverlap(startAt.getTime(), endAt.getTime(), b.startAt.getTime(), b.endAt.getTime()));
      const isHeld = heldMinutesOfDay.has(t);

      const status: SlotStatus = isBooked ? 'BOOKED' : isBlocked ? 'BLOCKED' : isHeld ? 'HELD' : 'AVAILABLE';

      slots.push({
        startAt,
        endAt,
        status,
        consultationType: params.consultationType ?? 'IN_CLINIC',
        durationMinutes,
        feeRupees,
      });
    }
  }

  slots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  return { slots, closedReason: null, doctor: doctorSummary, clinic: clinicSummary };
}
