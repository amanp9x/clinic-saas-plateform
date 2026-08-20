import { z } from 'zod';
import { ContactMessageStatus } from '../enums.js';

export const platformContactMessagesQuerySchema = z.object({
  status: z.nativeEnum(ContactMessageStatus).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type PlatformContactMessagesQuery = z.infer<typeof platformContactMessagesQuerySchema>;

/** NEW is deliberately absent as a target — an admin only ever moves a message forward, never
 * back to NEW, same convention as adminUpdateSupportTicketStatusSchema. `adminReply` is optional
 * even when resolving: not every inquiry warrants an email back (e.g. spam, duplicate). */
export const adminUpdateContactMessageStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'RESOLVED']),
  adminReply: z.string().trim().max(4000).optional().or(z.literal('')),
});
export type AdminUpdateContactMessageStatusInput = z.infer<typeof adminUpdateContactMessageStatusSchema>;
