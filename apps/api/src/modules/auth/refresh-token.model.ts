import { model, Schema, Types } from 'mongoose';

/**
 * One row per issued refresh token. Only a SHA-256 hash of the token is
 * stored, so a database leak doesn't hand out live sessions.
 *
 * Tokens are single-use: refreshing revokes the old row and issues a new one.
 * Presenting an already-revoked token means it was stolen (or replayed), so
 * every session of that user is revoked.
 */
export interface RefreshToken {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
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
    // TTL index: MongoDB deletes the row automatically once it expires.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: Date,
    userAgent: String,
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const RefreshTokenModel = model<RefreshToken>(
  'RefreshToken',
  refreshTokenSchema,
);
