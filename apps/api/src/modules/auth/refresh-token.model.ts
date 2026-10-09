import { model, Schema, Types } from 'mongoose';

/**
 * One row per issued refresh token. Only a SHA-256 hash of the token is
 * stored, so a database leak doesn't hand out live sessions.
 *
 * Tokens are single-use: refreshing revokes the old row and issues a new one
 * in the same `sessionId` (one sign-in on one device). Presenting a token
 * that was already *rotated* means it was copied (stolen or replayed), so every
 * session of that user is revoked, except within a short grace period after
 * rotation (see AuthService.refresh). Tokens revoked by logging out or
 * "sign out this device" simply stop working.
 */
export interface RefreshToken {
  userId: Types.ObjectId;
  tokenHash: string;
  /** Same for every token of one sign-in, across rotations. */
  sessionId: string;
  sessionStartedAt: Date;
  /** The sign-in passed two-step verification. */
  mfa: boolean;
  expiresAt: Date;
  revokedAt?: Date;
  /** Set when the token was replaced by refreshing (not by logging out). */
  rotatedAt?: Date;
  userAgent?: string;
  ip?: string;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<RefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true },
    sessionId: { type: String, required: true, index: true },
    sessionStartedAt: { type: Date, required: true },
    mfa: { type: Boolean, default: false },
    // TTL index: MongoDB deletes the row automatically once it expires.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: Date,
    rotatedAt: Date,
    userAgent: String,
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const RefreshTokenModel = model<RefreshToken>(
  'RefreshToken',
  refreshTokenSchema,
);
