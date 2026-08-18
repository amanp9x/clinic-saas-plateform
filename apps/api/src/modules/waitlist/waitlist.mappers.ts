import type { ClinicWaitlistRowDto, DoctorWaitlistRowDto, WaitlistDisplayStatus, WaitlistEntryDto } from '@clinic/shared';
import type { WaitlistStatus } from '@prisma/client';
import type { ClinicWaitlistRowWithRelations, DoctorWaitlistRowWithRelations, WaitlistEntryWithRelations } from './waitlist.repository.js';

function toDateOnlyString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** ACTIVE/NOTIFIED whose targetDate has passed present as EXPIRED — never stored, exactly like
 * SlotHold's own derived-at-read-time expiry (see WaitlistEntry's schema comment). */
function displayStatus(status: WaitlistStatus, targetDate: Date): WaitlistDisplayStatus {
  const isStale = status === 'ACTIVE' || status === 'NOTIFIED';
  if (isStale && targetDate.getTime() < Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())) {
    return 'EXPIRED';
  }
  return status;
}

export function toWaitlistEntryDto(entry: WaitlistEntryWithRelations): WaitlistEntryDto {
  const status = displayStatus(entry.status, entry.targetDate);
  return {
    id: entry.id,
    doctorId: entry.doctorId,
    doctorName: entry.doctor.displayName,
    doctorSlug: entry.doctor.slug,
    clinicId: entry.clinicId,
    clinicName: entry.clinic.name,
    targetDate: toDateOnlyString(entry.targetDate),
    consultationType: entry.consultationType,
    notes: entry.notes,
    status,
    notifiedAt: entry.notifiedAt ? entry.notifiedAt.toISOString() : null,
    fulfilledAppointmentId: entry.fulfilledAppointmentId,
    canCancel: status === 'ACTIVE' || status === 'NOTIFIED',
    createdAt: entry.createdAt.toISOString(),
  };
}

export function toClinicWaitlistRowDto(entry: ClinicWaitlistRowWithRelations): ClinicWaitlistRowDto {
  return {
    id: entry.id,
    patientId: entry.patientId,
    patientName: entry.patient.fullName,
    patientPhone: entry.patient.user.phone,
    doctorId: entry.doctorId,
    doctorName: entry.doctor.displayName,
    targetDate: toDateOnlyString(entry.targetDate),
    consultationType: entry.consultationType,
    notes: entry.notes,
    status: displayStatus(entry.status, entry.targetDate),
    notifiedAt: entry.notifiedAt ? entry.notifiedAt.toISOString() : null,
    createdAt: entry.createdAt.toISOString(),
  };
}

export function toDoctorWaitlistRowDto(entry: DoctorWaitlistRowWithRelations): DoctorWaitlistRowDto {
  return {
    id: entry.id,
    clinicId: entry.clinicId,
    clinicName: entry.clinic.name,
    targetDate: toDateOnlyString(entry.targetDate),
    consultationType: entry.consultationType,
    status: displayStatus(entry.status, entry.targetDate),
    notifiedAt: entry.notifiedAt ? entry.notifiedAt.toISOString() : null,
    createdAt: entry.createdAt.toISOString(),
  };
}
