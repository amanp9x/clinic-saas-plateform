import { OtpPurpose } from '@prisma/client';
import { otpRepository } from './otp.repository.js';
import { generateOtpCode } from '../../utils/otp-code.js';
import { sha256Hex } from '../../utils/hash.js';
import { identifierType } from '../../utils/identifier.js';
import { sendEmail } from '../../services/mailer.service.js';
import { sendSms } from '../../services/sms.service.js';
import { env } from '../../config/env.js';
import { RateLimitedError, UnauthorizedError } from '../../utils/app-error.js';

const OTP_MESSAGES: Record<OtpPurpose, { subject: string; body: (code: string) => string }> = {
  LOGIN: {
    subject: 'Your login code',
    body: (code) =>
      `Your Clinic SaaS Platform login code is ${code}. It expires in ${env.OTP_EXPIRY_MINUTES} minutes.`,
  },
  REGISTRATION: {
    subject: 'Your verification code',
    body: (code) =>
      `Your verification code is ${code}. It expires in ${env.OTP_EXPIRY_MINUTES} minutes.`,
  },
  EMAIL_VERIFICATION: {
    subject: 'Verify your email',
    body: (code) =>
      `Your email verification code is ${code}. It expires in ${env.OTP_EXPIRY_MINUTES} minutes.`,
  },
  MOBILE_VERIFICATION: {
    subject: 'Verify your mobile number',
    body: (code) =>
      `Your mobile verification code is ${code}. It expires in ${env.OTP_EXPIRY_MINUTES} minutes.`,
  },
  PASSWORD_RESET: {
    subject: 'Reset your password',
    body: (code) =>
      `Your password reset code is ${code}. It expires in ${env.OTP_EXPIRY_MINUTES} minutes. If you didn't request this, you can ignore this message.`,
  },
};

async function deliver(identifier: string, purpose: OtpPurpose, code: string): Promise<void> {
  const { subject, body } = OTP_MESSAGES[purpose];
  const text = body(code);

  if (identifierType(identifier) === 'email') {
    await sendEmail({ to: identifier, subject, html: `<p>${text}</p>`, text });
  } else {
    await sendSms({ to: identifier, message: text });
  }
}

export const otpService = {
  /** Generates, stores, and delivers an OTP code. Rate-limited per identifier+purpose. */
  async request(identifier: string, purpose: OtpPurpose): Promise<void> {
    const windowStart = new Date(Date.now() - env.OTP_WINDOW_MINUTES * 60_000);
    const recentCount = await otpRepository.countRecent(identifier, purpose, windowStart);
    if (recentCount >= env.OTP_MAX_PER_WINDOW) {
      throw new RateLimitedError(
        'Too many codes requested. Please wait a few minutes and try again.',
      );
    }

    await otpRepository.invalidateActive(identifier, purpose);

    const code = generateOtpCode();
    await otpRepository.create({
      identifier,
      purpose,
      codeHash: sha256Hex(code),
      expiresAt: new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60_000),
    });

    await deliver(identifier, purpose, code);
  },

  /** Verifies a code, consuming it on success. Throws on mismatch, expiry, or exhausted attempts. */
  async verify(identifier: string, purpose: OtpPurpose, code: string): Promise<void> {
    const record = await otpRepository.findActiveLatest(identifier, purpose);
    if (!record) {
      throw new UnauthorizedError('Code has expired or was not found. Request a new one.');
    }

    if (record.attempts >= record.maxAttempts) {
      throw new UnauthorizedError('Too many incorrect attempts. Request a new code.');
    }

    if (record.codeHash !== sha256Hex(code)) {
      await otpRepository.incrementAttempts(record.id);
      throw new UnauthorizedError('Incorrect code');
    }

    await otpRepository.consume(record.id);
  },
};
