import { z } from 'zod';
import { Gender } from '../enums.js';
import { emailSchema, otpCodeSchema, phoneSchema } from './auth.js';

export const addressLabelSchema = z.enum(['HOME', 'WORK', 'OTHER']);

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
  dateOfBirth: z.string().date().optional().or(z.literal('')),
  gender: z.nativeEnum(Gender).optional(),
  bloodGroup: z
    .string()
    .trim()
    .regex(/^(A|B|AB|O)[+-]$/, 'Enter a valid blood group, e.g. O+')
    .optional()
    .or(z.literal('')),
  allergies: z.array(z.string().trim().min(1)).max(30).default([]),
  medicalConditions: z.array(z.string().trim().min(1)).max(30).default([]),
  emergencyName: z.string().trim().max(120).optional().or(z.literal('')),
  emergencyPhone: phoneSchema.optional().or(z.literal('')),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const addressSchema = z.object({
  label: addressLabelSchema.default('HOME'),
  addressLine1: z.string().trim().min(3, 'Enter an address').max(200),
  addressLine2: z.string().trim().max(200).optional().or(z.literal('')),
  city: z.string().trim().min(2, 'Enter a city').max(80),
  state: z.string().trim().max(80).optional().or(z.literal('')),
  postalCode: z.string().trim().max(20).optional().or(z.literal('')),
  country: z.string().trim().max(56).default('IN'),
  isDefault: z.boolean().default(false),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const changeEmailRequestSchema = z.object({
  newEmail: emailSchema,
});
export type ChangeEmailRequestInput = z.infer<typeof changeEmailRequestSchema>;

export const changeEmailConfirmSchema = z.object({
  newEmail: emailSchema,
  code: otpCodeSchema,
});
export type ChangeEmailConfirmInput = z.infer<typeof changeEmailConfirmSchema>;

export const changeMobileRequestSchema = z.object({
  newPhone: phoneSchema,
});
export type ChangeMobileRequestInput = z.infer<typeof changeMobileRequestSchema>;

export const changeMobileConfirmSchema = z.object({
  newPhone: phoneSchema,
  code: otpCodeSchema,
});
export type ChangeMobileConfirmInput = z.infer<typeof changeMobileConfirmSchema>;

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password to confirm'),
  reason: z.string().trim().max(500).optional(),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

export const cancelAppointmentSchema = z.object({
  reason: z.string().trim().min(3, 'Let us know why you are cancelling').max(300),
});
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

export const appointmentTabSchema = z.enum(['upcoming', 'today', 'completed', 'cancelled']);
export type AppointmentTab = z.infer<typeof appointmentTabSchema>;

export const appointmentListQuerySchema = z.object({
  tab: appointmentTabSchema.default('upcoming'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type AppointmentListQuery = z.infer<typeof appointmentListQuerySchema>;

// notificationPreferenceSchema moved to validation/notification.ts (Phase 10).

export const notificationListQuerySchema = z.object({
  unreadOnly: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform((v) => v === true || v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
