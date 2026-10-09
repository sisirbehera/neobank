import { randomUUID } from 'node:crypto';
import type {
  LoginRequest,
  MfaChallenge,
  MfaSetupResponse,
  RegisterRequest,
  UserDto,
} from '@neobank/shared/models';
import type { AuthConfig } from '../../config/app-config';
import { HttpError } from '../../lib/http-error';
import { MfaService } from '../security/mfa.service';
import {
  MFA_SECRETS,
  toUserDto,
  UserDocument,
  UserModel,
} from '../users/user.model';
import { assertNotLocked, recordFailedAttempt } from './lockout';
import { hashPassword, verifyPassword } from './password';
import { RefreshTokenModel } from './refresh-token.model';
import {
  generateRefreshToken,
  hashToken,
  type MfaChallengeClaims,
  signAccessToken,
  signMfaChallenge,
  verifyMfaChallenge,
} from './tokens';

/** How long a just-rotated refresh token may still be used (lost responses). */
export const REUSE_GRACE_MS = 30_000;

export interface ClientMeta {
  userAgent?: string;
  ip?: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

/** Continues an existing sign-in when a refresh token is rotated. */
interface SessionContext {
  sessionId: string;
  sessionStartedAt: Date;
  mfa: boolean;
}

const invalidCredentials = () =>
  HttpError.unauthorized('Incorrect email or password', 'INVALID_CREDENTIALS');

const sessionExpired = () =>
  HttpError.unauthorized(
    'Your session has expired. Please log in again.',
    'SESSION_EXPIRED',
  );

const challengeExpired = () =>
  HttpError.unauthorized(
    'Your sign-in attempt expired. Please log in again.',
    'MFA_TOKEN_INVALID',
  );

const emailTaken = () => {
  const message = 'An account with this email already exists';
  return HttpError.conflict(message, 'EMAIL_TAKEN', { email: [message] });
};

export class AuthService {
  /** Hash used for unknown emails, so they take as long as wrong passwords. */
  private dummyHash?: Promise<string>;
  private readonly mfa: MfaService;

  constructor(private readonly config: AuthConfig) {
    this.mfa = new MfaService({
      encryptionKey: config.mfaEncryptionKey,
      tokenSecret: config.accessTokenSecret,
    });
  }

  async register(input: RegisterRequest, meta: ClientMeta): Promise<Session> {
    if (await UserModel.exists({ email: input.email })) throw emailTaken();

    try {
      const user = await UserModel.create({
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.password),
      });
      return this.issueSession(user, meta);
    } catch (err) {
      // Two sign-ups with the same email at once: the unique index wins.
      if ((err as { code?: number }).code === 11000) throw emailTaken();
      throw err;
    }
  }

  /**
   * Step 1 of signing in. Returns a session, or, when a second step is
   * needed, a short-lived challenge token (no session, no cookie):
   *  - VERIFY: 2FA is on → enter a code
   *  - ENROLL: admin without 2FA → must set it up before getting in
   */
  async login(
    input: LoginRequest,
    meta: ClientMeta,
  ): Promise<Session | MfaChallenge> {
    const user = await UserModel.findOne({ email: input.email }).select(
      '+passwordHash',
    );

    if (!user) {
      await verifyPassword(input.password, await this.getDummyHash());
      throw invalidCredentials();
    }

    assertNotLocked(user);

    if (!(await verifyPassword(input.password, user.passwordHash))) {
      await recordFailedAttempt(user._id);
      throw invalidCredentials();
    }

    user.failedLoginCount = 0;
    user.lockedUntil = undefined;
    await user.save();

    if (user.mfa?.enabled) return this.challenge(user, 'VERIFY');
    if (user.role === 'admin') return this.challenge(user, 'ENROLL');

    await this.markLoggedIn(user);
    return this.issueSession(user, meta);
  }

  /** Step 2: a 6-digit code (or a backup code) turns the challenge into a session. */
  async verifyMfa(
    mfaToken: string,
    code: string,
    meta: ClientMeta,
  ): Promise<Session> {
    const user = await this.userForChallenge(mfaToken, 'VERIFY');
    await this.mfa.requireCode(user, code);
    await this.markLoggedIn(user);
    return this.issueSession(user, meta, { mfa: true });
  }

  /** Admin's first sign-in: set up 2FA before anything else. */
  async enrollStart(mfaToken: string): Promise<MfaSetupResponse> {
    const user = await this.userForChallenge(mfaToken, 'ENROLL');
    return this.mfa.startSetup(user.id);
  }

  async enrollConfirm(
    mfaToken: string,
    code: string,
    meta: ClientMeta,
  ): Promise<{ session: Session; backupCodes: string[] }> {
    const user = await this.userForChallenge(mfaToken, 'ENROLL');
    const backupCodes = await this.mfa.confirmSetup(user.id, code);
    await this.markLoggedIn(user);
    const updated = await UserModel.findById(user._id);
    if (!updated) throw challengeExpired();
    return {
      session: await this.issueSession(updated, meta, { mfa: true }),
      backupCodes,
    };
  }

  /** Swaps a valid refresh token for a new session (token rotation). */
  async refresh(token: string | undefined, meta: ClientMeta): Promise<Session> {
    if (!token) throw sessionExpired();

    const now = new Date();
    const tokenHash = hashToken(token);

    // Atomically claim the token so it can only ever be used once.
    const claimed = await RefreshTokenModel.findOneAndUpdate(
      { tokenHash, revokedAt: { $exists: false }, expiresAt: { $gt: now } },
      { $set: { revokedAt: now, rotatedAt: now } },
    );

    if (!claimed) {
      const reused = await RefreshTokenModel.findOne({ tokenHash });

      // Grace period: the browser can lose the response that carried the new
      // cookie (tab closed, page reloaded mid-request, two tabs refreshing at
      // once) and retry with the old one. Treat a very recent rotation as that,
      // not as theft.
      if (
        reused?.rotatedAt &&
        reused.expiresAt > now &&
        now.getTime() - reused.rotatedAt.getTime() < REUSE_GRACE_MS
      ) {
        const user = await UserModel.findById(reused.userId);
        if (user) return this.issueSession(user, meta, contextOf(reused));
      }

      if (reused?.rotatedAt) {
        // A token that was already replaced came back: someone has a copy.
        // End every session (also closing grace periods). Tokens revoked by
        // logout / "sign out this device" never had rotatedAt, so they just fail.
        await RefreshTokenModel.updateMany(
          { userId: reused.userId },
          { $set: { revokedAt: now }, $unset: { rotatedAt: '' } },
        );
      }
      throw sessionExpired();
    }

    const user = await UserModel.findById(claimed.userId);
    if (!user) throw sessionExpired();

    return this.issueSession(user, meta, contextOf(claimed));
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await RefreshTokenModel.updateOne(
      { tokenHash: hashToken(token), revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
  }

  async getUser(userId: string): Promise<UserDto> {
    const user = await UserModel.findById(userId);
    if (!user) throw HttpError.unauthorized();
    return toUserDto(user);
  }

  private challenge(
    user: UserDocument,
    method: MfaChallengeClaims['purpose'],
  ): MfaChallenge {
    return {
      mfaRequired: true,
      method,
      mfaToken: signMfaChallenge(
        { sub: user.id, purpose: method },
        this.config.accessTokenSecret,
      ),
    };
  }

  private async userForChallenge(
    mfaToken: string,
    purpose: MfaChallengeClaims['purpose'],
  ): Promise<UserDocument> {
    const claims = verifyMfaChallenge(mfaToken, this.config.accessTokenSecret);
    if (!claims || claims.purpose !== purpose) throw challengeExpired();
    const user = await UserModel.findById(claims.sub).select(MFA_SECRETS);
    if (!user) throw challengeExpired();
    return user;
  }

  private async markLoggedIn(user: UserDocument): Promise<void> {
    await UserModel.updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date() } },
    );
  }

  private async issueSession(
    user: UserDocument,
    meta: ClientMeta,
    context: Partial<SessionContext> = {},
  ): Promise<Session> {
    const { accessTokenSecret, accessTokenTtlMinutes, refreshTokenTtlDays } =
      this.config;
    const mfa = context.mfa ?? false;
    const sessionId = context.sessionId ?? randomUUID();

    const refreshToken = generateRefreshToken();
    await RefreshTokenModel.create({
      userId: user._id,
      tokenHash: hashToken(refreshToken),
      sessionId,
      sessionStartedAt: context.sessionStartedAt ?? new Date(),
      mfa,
      expiresAt: new Date(Date.now() + refreshTokenTtlDays * 86_400_000),
      userAgent: meta.userAgent,
      ip: meta.ip,
    });

    return {
      accessToken: signAccessToken(
        { sub: user.id, role: user.role, mfa, sid: sessionId },
        accessTokenSecret,
        accessTokenTtlMinutes,
      ),
      refreshToken,
      user: toUserDto(user),
    };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= hashPassword('dummy-password-for-timing');
    return this.dummyHash;
  }
}

function contextOf(token: {
  sessionId: string;
  sessionStartedAt: Date;
  mfa: boolean;
}): SessionContext {
  return {
    sessionId: token.sessionId,
    sessionStartedAt: token.sessionStartedAt,
    mfa: token.mfa,
  };
}
