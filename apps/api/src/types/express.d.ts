import type { UserRole } from '@neobank/shared/models';

declare global {
  namespace Express {
    interface Request {
      /** Set by the requireAuth middleware. */
      auth?: { userId: string; role: UserRole };
    }
  }
}

export {};
