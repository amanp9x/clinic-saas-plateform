import type { SupportTicketCategory, SupportTicketStatus } from '../enums.js';

/** Phase 16 — Support Tickets & Grievance Resolution. Patients raise tickets about an
 * appointment, payment, doctor/clinic conduct, or a general platform issue; SUPER_ADMIN/
 * PLATFORM_ADMIN (the same platform-wide roles Phase 15 built a real portal for) triage and
 * resolve them. Reuses the notification/audit/socket infrastructure from every prior phase. */
export interface SupportTicketMessageDto {
  id: string;
  senderUserId: string;
  senderName: string;
  isFromAdmin: boolean;
  message: string;
  createdAt: string;
}

export interface SupportTicketRowDto {
  id: string;
  ticketNumber: string;
  category: SupportTicketCategory;
  subject: string;
  status: SupportTicketStatus;
  clinicId: string | null;
  clinicName: string | null;
  appointmentId: string | null;
  appointmentBookingReference: string | null;
  paymentId: string | null;
  raisedByUserId: string;
  raisedByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketDetailDto extends SupportTicketRowDto {
  description: string;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  messages: SupportTicketMessageDto[];
}
