import * as z from 'zod/mini';
import { AuthResponseSchema, NewPasswordSchema } from './auth';

// ---- Two-step verification (TOTP authenticator apps) ------------------------

/** A 6-digit code from an authenticator app. */
export const TotpCodeSchema = z
  .string()
  .check(
    z.trim(),
    z.regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
  );

/** A 6-digit code, or a single-use backup code like "K7QF-2M9X". */
export const MfaCodeSchema = z
  .string()
  .check(
    z.trim(),
    z.regex(
      /^(\d{6}|[A-Za-z0-9]{4}-?[A-Za-z0-9]{4})$/,
      'Enter the 6-digit code or a backup code',
    ),
  );

/** Password was right, but a second step is needed before a session starts. */
export const MfaChallengeSchema = z.object({
  mfaRequired: z.literal(true),
  /** Short-lived token proving the password step passed. */
  mfaToken: z.string(),
  /** VERIFY: enter a code. ENROLL: set up 2FA first (required for admins). */
  method: z.enum(['VERIFY', 'ENROLL']),
});
export type MfaChallenge = z.infer<typeof MfaChallengeSchema>;

/** POST /api/auth/login returns either a session or a 2FA challenge. */
export const LoginResponseSchema = z.union([
  AuthResponseSchema,
  MfaChallengeSchema,
]);
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

const MfaTokenSchema = z.string().check(z.minLength(1));

export const MfaVerifyRequestSchema = z.object({
  mfaToken: MfaTokenSchema,
  code: MfaCodeSchema,
});
export type MfaVerifyRequest = z.input<typeof MfaVerifyRequestSchema>;

export const MfaTokenRequestSchema = z.object({ mfaToken: MfaTokenSchema });

export const MfaSetupResponseSchema = z.object({
  /** Base32 secret, for typing into an app that can't scan. */
  secret: z.string(),
  otpauthUrl: z.string(),
  /** QR code of otpauthUrl as a data: URL image. */
  qrCodeDataUrl: z.string(),
});
export type MfaSetupResponse = z.infer<typeof MfaSetupResponseSchema>;

export const MfaEnableRequestSchema = z.object({ code: TotpCodeSchema });
export const MfaEnrollConfirmRequestSchema = z.object({
  mfaToken: MfaTokenSchema,
  code: TotpCodeSchema,
});

export const BackupCodesResponseSchema = z.object({
  /** Shown once. Each works one time if the phone is lost. */
  backupCodes: z.array(z.string()),
});
export type BackupCodesResponse = z.infer<typeof BackupCodesResponseSchema>;

/** Finishing 2FA setup during login: a session plus the backup codes. */
export const EnrollConfirmResponseSchema = z.extend(
  AuthResponseSchema,
  BackupCodesResponseSchema.shape,
);
export type EnrollConfirmResponse = z.infer<typeof EnrollConfirmResponseSchema>;

export const MfaDisableRequestSchema = z.object({
  password: z.string().check(z.minLength(1, 'Password is required')),
  code: MfaCodeSchema,
});
export type MfaDisableRequest = z.input<typeof MfaDisableRequestSchema>;

// ---- Step-up verification for risky actions ---------------------------------

export const StepUpActionSchema = z.enum(['ADD_BENEFICIARY', 'LARGE_TRANSFER']);
export type StepUpAction = z.infer<typeof StepUpActionSchema>;

/** Transfers to other people above this need a fresh 2FA code (₹10,000). */
export const STEP_UP_TRANSFER_THRESHOLD_PAISE = 10_000_00;

/** Header carrying a step-up token on the retried request. */
export const STEP_UP_HEADER = 'X-Step-Up-Token';

export const StepUpRequestSchema = z.object({
  action: StepUpActionSchema,
  code: MfaCodeSchema,
});
export type StepUpRequest = z.input<typeof StepUpRequestSchema>;

export const StepUpResponseSchema = z.object({
  stepUpToken: z.string(),
  expiresInSeconds: z.int(),
});
export type StepUpResponse = z.infer<typeof StepUpResponseSchema>;

// ---- Password & sessions ------------------------------------------------------

export const ChangePasswordRequestSchema = z
  .object({
    currentPassword: z
      .string()
      .check(z.minLength(1, 'Current password is required')),
    newPassword: NewPasswordSchema,
  })
  .check(
    z.refine((v) => v.currentPassword !== v.newPassword, {
      error: 'The new password must be different',
      path: ['newPassword'],
    }),
  );
export type ChangePasswordRequest = z.input<typeof ChangePasswordRequestSchema>;

export const SessionDtoSchema = z.object({
  /** Stays the same across token refreshes on one device. */
  id: z.string(),
  userAgent: z.string(),
  ip: z.string(),
  startedAt: z.iso.datetime(),
  lastActiveAt: z.iso.datetime(),
  current: z.boolean(),
  /** Signed in with a second step (2FA). */
  mfa: z.boolean(),
});
export type SessionDto = z.infer<typeof SessionDtoSchema>;
