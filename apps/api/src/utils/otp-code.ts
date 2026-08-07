import crypto from 'node:crypto';
import { env } from '../config/env.js';

/** Generates a cryptographically random numeric OTP code of the configured length. */
export function generateOtpCode(): string {
  const digits = env.OTP_LENGTH;
  const max = 10 ** digits;
  const code = crypto.randomInt(0, max);
  return code.toString().padStart(digits, '0');
}
