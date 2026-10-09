import type { UserRole } from '@neobank/shared/models';

declare global {
  namespace Express {
    interface Request {
      /** Set by the requireAuth middleware. */
      auth?: {
        userId: string;
        role: UserRole;
        mfa: boolean;
        /** Session id of this sign-in (same across token refreshes). */
        sessionId: string;
      };
    }
  }
}

export {};
