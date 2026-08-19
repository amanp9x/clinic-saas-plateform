import type { SupportTicketDetailDto, SupportTicketMessageDto, SupportTicketRowDto } from '@clinic/shared';
import { UserRole } from '@clinic/shared';
import type { SupportTicketDetailWithRelations, SupportTicketRowWithRelations } from './support-ticket.repository.js';

const ADMIN_ROLES: string[] = [UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN];

/** Admin senders are shown as "Support Team", never by their personal identity — a patient has no
 * legitimate need to know which individual platform admin replied, and this avoids leaking admin
 * account details into a channel the patient can read indefinitely. */
function displayNameFor(user: { role: string; email: string | null; patientProfile: { fullName: string } | null }): string {
  if (ADMIN_ROLES.includes(user.role)) return 'Support Team';
  return user.patientProfile?.fullName ?? user.email ?? 'Patient';
}

export function toSupportTicketRowDto(row: SupportTicketRowWithRelations): SupportTicketRowDto {
  return {
    id: row.id,
    ticketNumber: row.ticketNumber,
    category: row.category,
    subject: row.subject,
    status: row.status,
    clinicId: row.clinic?.id ?? null,
    clinicName: row.clinic?.name ?? null,
    appointmentId: row.appointment?.id ?? null,
    appointmentBookingReference: row.appointment?.bookingReference ?? null,
    paymentId: row.paymentId,
    raisedByUserId: row.raisedByUserId,
    raisedByName: displayNameFor(row.raisedBy),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toSupportTicketDetailDto(row: SupportTicketDetailWithRelations): SupportTicketDetailDto {
  return {
    ...toSupportTicketRowDto(row),
    description: row.description,
    resolutionNotes: row.resolutionNotes,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    messages: row.messages.map(toSupportTicketMessageDto),
  };
}

function toSupportTicketMessageDto(message: SupportTicketDetailWithRelations['messages'][number]): SupportTicketMessageDto {
  const isFromAdmin = ADMIN_ROLES.includes(message.sender.role);
  return {
    id: message.id,
    senderUserId: message.senderUserId,
    senderName: displayNameFor(message.sender),
    isFromAdmin,
    message: message.message,
    createdAt: message.createdAt.toISOString(),
  };
}
