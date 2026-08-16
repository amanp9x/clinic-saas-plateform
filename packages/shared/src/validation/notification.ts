import { z } from 'zod';

export const notificationPreferenceSchema = z.object({
  appointmentEmail: z.boolean(),
  appointmentInApp: z.boolean(),
  paymentEmail: z.boolean(),
  paymentInApp: z.boolean(),
  queueEmail: z.boolean(),
  queueInApp: z.boolean(),
  prescriptionEmail: z.boolean(),
  prescriptionInApp: z.boolean(),
  announcementEmail: z.boolean(),
  announcementInApp: z.boolean(),
});
export type NotificationPreferenceInput = z.infer<typeof notificationPreferenceSchema>;

export const notificationIdParamSchema = z.object({
  id: z.string().uuid('Invalid notification id'),
});

export const clinicAnnouncementSchema = z.object({
  clinicId: z.string().uuid('Select a clinic'),
  title: z.string().trim().min(3).max(150),
  message: z.string().trim().min(3).max(1000),
  audience: z.enum(['PATIENTS', 'STAFF']),
});
export type ClinicAnnouncementInput = z.infer<typeof clinicAnnouncementSchema>;
