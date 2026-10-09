import * as z from 'zod/mini';

export const UserRoleSchema = z.enum(['customer', 'admin']);
export type UserRole = z.infer<typeof UserRoleSchema>;

// ---- Field rules (reused by Angular form controls) --------------------------

export const NameSchema = z
  .string()
  .check(
    z.trim(),
    z.minLength(2, 'Name must be at least 2 characters'),
    z.maxLength(80, 'Name must be at most 80 characters'),
  );

export const EmailSchema = z.pipe(
  z.string().check(z.trim(), z.toLowerCase()),
  z.email('Enter a valid email address'),
);

export const NewPasswordSchema = z
  .string()
  .check(
    z.minLength(8, 'Password must be at least 8 characters'),
    z.maxLength(72, 'Password must be at most 72 characters'),
    z.regex(/[A-Za-z]/, 'Password must contain a letter'),
    z.regex(/\d/, 'Password must contain a number'),
  );

// ---- Requests ---------------------------------------------------------------

export const RegisterRequestSchema = z.object({
  name: NameSchema,
  email: EmailSchema,
  password: NewPasswordSchema,
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  // Don't apply the "new password" rules here: older passwords must still work.
  password: z
    .string()
    .check(z.minLength(1, 'Password is required'), z.maxLength(200)),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

// ---- Responses --------------------------------------------------------------

export const UserDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: UserRoleSchema,
  /** Two-step verification (authenticator app) is on. */
  mfaEnabled: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type UserDto = z.infer<typeof UserDtoSchema>;

/** Returned by register, login and refresh. The refresh token travels as an httpOnly cookie. */
export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  user: UserDtoSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
