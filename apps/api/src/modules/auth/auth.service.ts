import type {
  LoginRequest,
  RegisterRequest,
  UserDto,
} from '@neobank/shared/models';
import type { AuthConfig } from '../../config/app-config';
import { HttpError } from '../../lib/http-error';
import { toUserDto, UserDocument, UserModel } from '../users/user.model';
import { hashPassword, verifyPassword } from './password';
import { RefreshTokenModel } from './refresh-token.model';
import { generateRefreshToken, hashToken, signAccessToken } from './tokens';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export interface ClientMeta {
  userAgent?: string;
  ip?: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

const invalidCredentials = () =>
  HttpError.unauthorized('Incorrect email or password', 'INVALID_CREDENTIALS');

const sessionExpired = () =>
  HttpError.unauthorized(
    'Your session has expired. Please log in again.',
    'SESSION_EXPIRED',
  );

const emailTaken = () => {
  const message = 'An account with this email already exists';
  return HttpError.conflict(message, 'EMAIL_TAKEN', { email: [message] });
};

export class AuthService {
  /** Hash used for unknown emails, so they take as long as wrong passwords. */
  private dummyHash?: Promise<string>;

  constructor(private readonly config: AuthConfig) {}

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

  async login(input: LoginRequest, meta: ClientMeta): Promise<Session> {
    const user = await UserModel.findOne({ email: input.email }).select(
      '+passwordHash',
    );

    if (!user) {
      await verifyPassword(input.password, await this.getDummyHash());
      throw invalidCredentials();
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60_000,
      );
      throw new HttpError(
        423,
        'ACCOUNT_LOCKED',
        `Too many failed attempts. Try again in ${minutes} minute(s).`,
      );
    }

    if (!(await verifyPassword(input.password, user.passwordHash))) {
      await this.recordFailedLogin(user);
      throw invalidCredentials();
    }

    user.failedLoginCount = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    return this.issueSession(user, meta);
  }

  /** Swaps a valid refresh token for a new session (token rotation). */
  async refresh(token: string | undefined, meta: ClientMeta): Promise<Session> {
    if (!token) throw sessionExpired();

    const now = new Date();
    const tokenHash = hashToken(token);

    // Atomically claim the token so it can only ever be used once.
    const claimed = await RefreshTokenModel.findOneAndUpdate(
      { tokenHash, revokedAt: { $exists: false }, expiresAt: { $gt: now } },
      { $set: { revokedAt: now } },
    );

    if (!claimed) {
      const reused = await RefreshTokenModel.findOne({ tokenHash });
      if (reused?.revokedAt) {
        // A revoked token came back: assume it was stolen and end every session.
        await RefreshTokenModel.updateMany(
          { userId: reused.userId, revokedAt: { $exists: false } },
          { $set: { revokedAt: now } },
        );
      }
      throw sessionExpired();
    }

    const user = await UserModel.findById(claimed.userId);
    if (!user) throw sessionExpired();

    return this.issueSession(user, meta);
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

  private async issueSession(
    user: UserDocument,
    meta: ClientMeta,
  ): Promise<Session> {
    const { accessTokenSecret, accessTokenTtlMinutes, refreshTokenTtlDays } =
      this.config;

    const refreshToken = generateRefreshToken();
    await RefreshTokenModel.create({
      userId: user._id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshTokenTtlDays * 86_400_000),
      userAgent: meta.userAgent,
      ip: meta.ip,
    });

    return {
      accessToken: signAccessToken(
        { sub: user.id, role: user.role },
        accessTokenSecret,
        accessTokenTtlMinutes,
      ),
      refreshToken,
      user: toUserDto(user),
    };
  }

  private async recordFailedLogin(user: UserDocument): Promise<void> {
    // $inc is atomic, so parallel guesses can't slip past the limit.
    const updated = await UserModel.findByIdAndUpdate(
      user._id,
      { $inc: { failedLoginCount: 1 } },
      { returnDocument: 'after' },
    );
    if (updated && updated.failedLoginCount >= MAX_FAILED_LOGINS) {
      await UserModel.updateOne(
        { _id: user._id },
        {
          $set: {
            failedLoginCount: 0,
            lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000),
          },
        },
      );
    }
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= hashPassword('dummy-password-for-timing');
    return this.dummyHash;
  }
}
