import { HydratedDocument, model, Schema } from 'mongoose';
import type { UserDto, UserRole } from '@neobank/shared/models';

/** Two-step verification state. Secrets are never selected unless asked for. */
export interface UserMfa {
  enabled: boolean;
  /** AES-GCM encrypted TOTP secret (see lib/crypto-box). */
  secretEnc?: string;
  /** Secret generated during setup, until the first code confirms it. */
  pendingSecretEnc?: string;
  /** SHA-256 hashes of unused backup codes. */
  backupCodeHashes: string[];
  /** Last accepted TOTP time step: a code can't be used twice. */
  lastUsedStep?: number;
  enabledAt?: Date;
}

export interface User {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  failedLoginCount: number;
  lockedUntil?: Date;
  lastLoginAt?: Date;
  mfa: UserMfa;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;

/** Use with .select() when the MFA secrets are needed. */
export const MFA_SECRETS =
  '+mfa.secretEnc +mfa.pendingSecretEnc +mfa.backupCodeHashes';

const userSchema = new Schema<User>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Never returned by queries unless explicitly selected with '+passwordHash'.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: Date,
    lastLoginAt: Date,
    mfa: {
      enabled: { type: Boolean, default: false },
      secretEnc: { type: String, select: false },
      pendingSecretEnc: { type: String, select: false },
      backupCodeHashes: { type: [String], default: [], select: false },
      lastUsedStep: Number,
      enabledAt: Date,
    },
  },
  { timestamps: true },
);

export const UserModel = model<User>('User', userSchema);

/** The only shape of a user that ever leaves the API. */
export function toUserDto(user: UserDocument): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mfaEnabled: !!user.mfa?.enabled,
    createdAt: user.createdAt.toISOString(),
  };
}
