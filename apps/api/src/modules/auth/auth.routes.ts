import { Router } from 'express';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  otpRequestSchema,
  otpVerifySchema,
  refreshSchema,
  registerSchema,
  resendEmailVerificationSchema,
  resetPasswordSchema,
  sessionIdParamSchema,
  verifyEmailSchema,
} from '@clinic/shared';
import { authController } from './auth.controller.js';
import { otpController } from './otp.controller.js';
import { sessionController } from './session.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { authRateLimiter, otpRequestRateLimiter } from '../../middleware/rate-limit.js';

export const authRouter = Router();

// --- Password auth ---------------------------------------------------------

authRouter.post(
  '/register',
  authRateLimiter,
  validate({ body: registerSchema }),
  authController.register,
);
authRouter.post('/login', authRateLimiter, validate({ body: loginSchema }), authController.login);
authRouter.post('/refresh', validate({ body: refreshSchema }), authController.refresh);
authRouter.get('/me', authenticate, authController.me);
authRouter.post('/logout', authController.logout);
authRouter.post('/logout-all', authenticate, authController.logoutAll);
authRouter.post(
  '/password/change',
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);
authRouter.post(
  '/password/forgot',
  authRateLimiter,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword,
);
authRouter.post(
  '/password/reset',
  authRateLimiter,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword,
);

// --- OTP login (email or mobile) -------------------------------------------

authRouter.post(
  '/otp/request',
  otpRequestRateLimiter,
  validate({ body: otpRequestSchema }),
  otpController.requestLogin,
);
authRouter.post(
  '/otp/verify',
  authRateLimiter,
  validate({ body: otpVerifySchema }),
  otpController.verifyLogin,
);

// --- Email verification -----------------------------------------------------

authRouter.post(
  '/email/resend',
  otpRequestRateLimiter,
  validate({ body: resendEmailVerificationSchema }),
  otpController.resendEmailVerification,
);
authRouter.post(
  '/email/verify',
  authRateLimiter,
  validate({ body: verifyEmailSchema }),
  otpController.verifyEmail,
);

// --- Sessions / device management -------------------------------------------

authRouter.get('/sessions', authenticate, sessionController.list);
authRouter.delete(
  '/sessions/:id',
  authenticate,
  validate({ params: sessionIdParamSchema }),
  sessionController.revoke,
);
