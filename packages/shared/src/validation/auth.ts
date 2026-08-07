import { z } from 'zod';

/**
 * Single source of truth for auth request shapes — imported by apps/api's request
 * validation middleware AND apps/web's React Hook Form resolvers, so client and
 * server never drift apart.
 */

const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address');

export const phoneSchema = z
  .string()
  .trim()
  .regex(PHONE_REGEX, 'Enter a valid phone number in international format, e.g. +919876543210');

/** Accepts either an email or a phone number — used by OTP request/verify. */
export const identifierSchema = z
  .string()
  .trim()
  .min(1, 'Email or phone number is required')
  .refine((val) => emailSchema.safeParse(val).success || phoneSchema.safeParse(val).success, {
    message: 'Enter a valid email address or phone number',
  })
  .transform((val) => (emailSchema.safeParse(val).success ? val.toLowerCase() : val));

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{4,10}$/, 'Enter the numeric code you received');

export const fullNameSchema = z.string().trim().min(2, 'Enter your full name').max(120);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
  phone: phoneSchema.optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const otpRequestSchema = z.object({
  identifier: identifierSchema,
});
export type OtpRequestInput = z.infer<typeof otpRequestSchema>;

export const otpVerifySchema = z.object({
  identifier: identifierSchema,
  code: otpCodeSchema,
});
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;

export const verifyEmailSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendEmailVerificationSchema = z.object({
  email: emailSchema,
});
export type ResendEmailVerificationInput = z.infer<typeof resendEmailVerificationSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const sessionIdParamSchema = z.object({
  id: z.string().uuid('Invalid session id'),
});
export type SessionIdParam = z.infer<typeof sessionIdParamSchema>;
