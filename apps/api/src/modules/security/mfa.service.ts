import { createHash, randomInt } from 'node:crypto';
import QRCode from 'qrcode';
import type {
  MfaSetupResponse,
  StepUpAction,
  StepUpResponse,
} from '@neobank/shared/models';
import { decryptSecret, encryptSecret } from '../../lib/crypto-box';
import { HttpError } from '../../lib/http-error';
import { generateTotpSecret, totpUri, verifyTotp } from '../../lib/totp';
import {
  assertNotLocked,
  clearFailedAttempts,
  recordFailedAttempt,
} from '../auth/lockout';
import { verifyPassword } from '../auth/password';
import { signStepUp, STEP_UP_TTL_SECONDS, verifyStepUp } from '../auth/tokens';
import { MFA_SECRETS, type UserDocument, UserModel } from '../users/user.model';

const ISSUER = 'NeoBank';
const BACKUP_CODE_COUNT = 10;
// No 0/O, 1/I/L: easy to read off paper.
const BACKUP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const hashBackupCode = (code: string) =>
  createHash('sha256')
    .update(code.replace(/-/g, '').toUpperCase())
    .digest('hex');

const invalidCode = (field = 'code') =>
  new HttpError(401, 'INVALID_CODE', 'That code is not correct', {
    [field]: ['That code is not correct'],
  });

export interface MfaConfig {
  encryptionKey: string;
  tokenSecret: string;
}

/** Two-step verification: setup, checking codes, backup codes, step-up. */
export class MfaService {
  constructor(private readonly config: MfaConfig) {}

  // ---- Setup ---------------------------------------------------------------

  /** Creates a new secret (not active until confirmSetup) and its QR code. */
  async startSetup(userId: string): Promise<MfaSetupResponse> {
    const user = await this.findUser(userId);
    if (user.mfa?.enabled) {
      throw HttpError.conflict(
        'Two-step verification is already on',
        'MFA_ALREADY_ENABLED',
      );
    }
    const secret = generateTotpSecret();
    await UserModel.updateOne(
      { _id: userId },
      { $set: { 'mfa.pendingSecretEnc': this.encrypt(secret) } },
    );
    const otpauthUrl = totpUri(secret, user.email, ISSUER);
    return {
      secret,
      otpauthUrl,
      qrCodeDataUrl: await QRCode.toDataURL(otpauthUrl, {
        margin: 1,
        width: 200,
      }),
    };
  }

  /** The first correct code proves the phone has the secret: turn 2FA on. */
  async confirmSetup(userId: string, code: string): Promise<string[]> {
    const user = await this.findUser(userId);
    if (user.mfa?.enabled) {
      throw HttpError.conflict(
        'Two-step verification is already on',
        'MFA_ALREADY_ENABLED',
      );
    }
    if (!user.mfa?.pendingSecretEnc) {
      throw HttpError.conflict(
        'Start the setup first',
        'MFA_SETUP_NOT_STARTED',
      );
    }
    const step = verifyTotp(this.decrypt(user.mfa.pendingSecretEnc), code);
    if (step === null) {
      throw HttpError.badRequest(
        'That code is not correct. Check the time on your phone and try again.',
        { code: ['That code is not correct'] },
      );
    }

    const backupCodes = generateBackupCodes();
    await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          'mfa.enabled': true,
          'mfa.secretEnc': user.mfa.pendingSecretEnc,
          'mfa.lastUsedStep': step,
          'mfa.enabledAt': new Date(),
          'mfa.backupCodeHashes': backupCodes.map(hashBackupCode),
        },
        $unset: { 'mfa.pendingSecretEnc': '' },
      },
    );
    return backupCodes;
  }

  async disable(userId: string, password: string, code: string): Promise<void> {
    const user = await this.findUser(userId, '+passwordHash');
    if (user.role === 'admin') {
      throw HttpError.forbidden('Admins must keep two-step verification on');
    }
    if (!user.mfa?.enabled) return;
    assertNotLocked(user);

    if (!(await verifyPassword(password, user.passwordHash))) {
      await recordFailedAttempt(user._id);
      throw HttpError.badRequest('Password is not correct', {
        password: ['Password is not correct'],
      });
    }
    await this.requireCode(user, code);

    await UserModel.updateOne(
      { _id: userId },
      {
        $set: { 'mfa.enabled': false, 'mfa.backupCodeHashes': [] },
        $unset: {
          'mfa.secretEnc': '',
          'mfa.lastUsedStep': '',
          'mfa.enabledAt': '',
        },
      },
    );
  }

  async regenerateBackupCodes(userId: string, code: string): Promise<string[]> {
    const user = await this.findUser(userId);
    this.assertEnabled(user);
    await this.requireCode(user, code);
    const backupCodes = generateBackupCodes();
    await UserModel.updateOne(
      { _id: userId },
      { $set: { 'mfa.backupCodeHashes': backupCodes.map(hashBackupCode) } },
    );
    return backupCodes;
  }

  // ---- Checking codes --------------------------------------------------------

  /**
   * Checks a 6-digit code or a backup code, counting failures towards the
   * lockout. Throws on a wrong or reused code.
   */
  async requireCode(user: UserDocument, code: string): Promise<void> {
    assertNotLocked(user);
    if (await this.checkCode(user, code)) {
      await clearFailedAttempts(user._id);
      return;
    }
    await recordFailedAttempt(user._id);
    throw invalidCode();
  }

  private async checkCode(user: UserDocument, code: string): Promise<boolean> {
    const trimmed = code.trim();

    if (/^\d{6}$/.test(trimmed)) {
      if (!user.mfa?.secretEnc) return false;
      const step = verifyTotp(this.decrypt(user.mfa.secretEnc), trimmed);
      if (step === null) return false;

      // Atomically move lastUsedStep forward: each code works once, even if
      // two requests race with the same code.
      const { modifiedCount } = await UserModel.updateOne(
        {
          _id: user._id,
          $or: [
            { 'mfa.lastUsedStep': { $exists: false } },
            { 'mfa.lastUsedStep': { $lt: step } },
          ],
        },
        { $set: { 'mfa.lastUsedStep': step } },
      );
      if (modifiedCount === 0) {
        throw new HttpError(
          401,
          'CODE_ALREADY_USED',
          'This code was already used. Wait for the next one.',
          { code: ['This code was already used. Wait for the next one.'] },
        );
      }
      return true;
    }

    // Backup code: remove it as it is used ($pull is atomic → single use).
    const { modifiedCount } = await UserModel.updateOne(
      { _id: user._id, 'mfa.backupCodeHashes': hashBackupCode(trimmed) },
      { $pull: { 'mfa.backupCodeHashes': hashBackupCode(trimmed) } },
    );
    return modifiedCount === 1;
  }

  // ---- Step-up for risky actions ----------------------------------------------

  /** Swaps a fresh code for a short-lived token that allows one kind of action. */
  async stepUp(
    userId: string,
    action: StepUpAction,
    code: string,
  ): Promise<StepUpResponse> {
    const user = await this.findUser(userId);
    this.assertEnabled(user);
    await this.requireCode(user, code);
    return {
      stepUpToken: signStepUp({ sub: userId, action }, this.config.tokenSecret),
      expiresInSeconds: STEP_UP_TTL_SECONDS,
    };
  }

  /**
   * Call before a risky action. Users without 2FA pass (it's optional for
   * customers); users with 2FA need a valid step-up token for this action.
   */
  async requireStepUp(
    userId: string,
    action: StepUpAction,
    token: string | undefined,
  ): Promise<void> {
    const user = await UserModel.findById(userId);
    if (!user?.mfa?.enabled) return;

    const claims = token ? verifyStepUp(token, this.config.tokenSecret) : null;
    if (claims?.sub === userId && claims.action === action) return;

    throw new HttpError(
      403,
      'STEP_UP_REQUIRED',
      'Enter a code from your authenticator app to continue',
      undefined,
      { action },
    );
  }

  // ---- Helpers -------------------------------------------------------------------

  private async findUser(userId: string, extra = ''): Promise<UserDocument> {
    const user = await UserModel.findById(userId).select(
      `${MFA_SECRETS} ${extra}`.trim(),
    );
    if (!user) throw HttpError.unauthorized();
    return user;
  }

  private assertEnabled(user: UserDocument): void {
    if (!user.mfa?.enabled) {
      throw HttpError.conflict(
        'Turn on two-step verification first',
        'MFA_NOT_ENABLED',
      );
    }
  }

  private encrypt(secret: string): string {
    return encryptSecret(secret, this.config.encryptionKey);
  }

  private decrypt(box: string): string {
    return decryptSecret(box, this.config.encryptionKey);
  }
}

function generateBackupCodes(): string[] {
  const part = () =>
    Array.from({ length: 4 }, () =>
      BACKUP_ALPHABET.charAt(randomInt(BACKUP_ALPHABET.length)),
    ).join('');
  return Array.from({ length: BACKUP_CODE_COUNT }, () => `${part()}-${part()}`);
}
