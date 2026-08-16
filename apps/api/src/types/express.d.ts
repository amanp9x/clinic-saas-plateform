import type { UserRole } from '@clinic/shared';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
        sessionId: string;
      };
      /** Raw request bytes, captured by express.json()'s `verify` hook in app.ts — needed for
       * payment-webhook signature verification, which must hash the exact bytes the provider
       * signed, not a re-serialized JSON.stringify() of the parsed body. */
      rawBody?: Buffer;
    }
  }
}

export {};
