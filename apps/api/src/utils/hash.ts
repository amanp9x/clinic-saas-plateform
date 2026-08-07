import crypto from 'node:crypto';

/** Fast, deterministic hash for opaque tokens/codes we need to look up by exact match (refresh tokens, OTP codes). Not for passwords — use bcrypt for those. */
export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
