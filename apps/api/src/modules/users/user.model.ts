import { HydratedDocument, model, Schema } from 'mongoose';
import type { UserDto, UserRole } from '@neobank/shared/models';

export interface User {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  failedLoginCount: number;
  lockedUntil?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;

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
    createdAt: user.createdAt.toISOString(),
  };
}
