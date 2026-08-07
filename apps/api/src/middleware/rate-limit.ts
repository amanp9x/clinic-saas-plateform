import rateLimit from 'express-rate-limit';
import { env, isTest } from '../config/env.js';
import { ErrorCode } from '@clinic/shared';

// express-rate-limit's in-memory store is shared for the lifetime of the process, which
// would make automated tests flaky (hits accumulate across test cases). Real request
// throttling is exercised by dedicated rate-limit tests instead; skip it everywhere else in test env.
const skipInTest = () => isTest;

/** General-purpose API rate limiter. Stricter limiters (e.g. for OTP/login) are defined per-module. */
export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: { code: ErrorCode.RATE_LIMITED, message: 'Too many requests, please try again later' },
    });
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: { code: ErrorCode.RATE_LIMITED, message: 'Too many authentication attempts' },
    });
  },
});

/** Tighter, IP-scoped limiter for OTP-send endpoints — layered on top of the per-identifier limit in otp.service. */
export const otpRequestRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: { code: ErrorCode.RATE_LIMITED, message: 'Too many code requests from this network' },
    });
  },
});
