import { z } from 'zod';
import { SupportTicketCategory, SupportTicketStatus } from '../enums.js';

export const createSupportTicketSchema = z.object({
  category: z.nativeEnum(SupportTicketCategory),
  subject: z.string().trim().min(3, 'Enter a subject').max(200),
  description: z.string().trim().min(10, 'Please describe the issue in a bit more detail').max(4000),
  appointmentId: z.string().uuid('Invalid appointment id').optional(),
  paymentId: z.string().uuid('Invalid payment id').optional(),
});
export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;

export const supportTicketMessageSchema = z.object({
  message: z.string().trim().min(1, 'Enter a message').max(2000),
});
export type SupportTicketMessageInput = z.infer<typeof supportTicketMessageSchema>;

export const mySupportTicketsQuerySchema = z.object({
  status: z.nativeEnum(SupportTicketStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type MySupportTicketsQuery = z.infer<typeof mySupportTicketsQuerySchema>;

export const platformSupportTicketsQuerySchema = z.object({
  status: z.nativeEnum(SupportTicketStatus).optional(),
  category: z.nativeEnum(SupportTicketCategory).optional(),
  clinicId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type PlatformSupportTicketsQuery = z.infer<typeof platformSupportTicketsQuerySchema>;

/** OPEN is deliberately absent — an admin only ever moves a ticket forward from OPEN
 * (to IN_PROGRESS) or terminally (to CLOSED); nothing ever transitions *back* to OPEN. */
export const adminUpdateSupportTicketStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'RESOLVED', 'CLOSED']),
  resolutionNotes: z.string().trim().max(2000).optional().or(z.literal('')),
});
export type AdminUpdateSupportTicketStatusInput = z.infer<typeof adminUpdateSupportTicketStatusSchema>;
