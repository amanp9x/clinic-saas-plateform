/**
 * Holds the short-lived access token in memory only (never localStorage/sessionStorage,
 * to limit exposure to XSS). The refresh token lives in an httpOnly cookie set by the
 * API and is never touched by client-side JS.
 */
let accessToken: string | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
  clear: () => {
    accessToken = null;
  },
};
