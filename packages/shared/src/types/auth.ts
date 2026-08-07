import type { UserRole } from '../enums.js';

/** Shape of the payload encoded into access/refresh JWTs. `jti` uniquely identifies each signed token (not the session). */
export interface JwtPayload {
  sub: string;
  role: UserRole;
  sessionId: string;
  jti?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  isEmailVerified: boolean;
  isMobileVerified: boolean;
}

export interface SessionSummary {
  id: string;
  deviceLabel: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isCurrent: boolean;
}
