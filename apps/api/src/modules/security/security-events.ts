import { model, Schema, Types } from 'mongoose';
import type {
  NotificationType,
  SecurityEventDto,
  SecurityEventType,
} from '@neobank/shared/models';
import { notify } from '../notifications/notifications';
import { isDemoAccount } from '../users/demo-account';

/**
 * The customer's own security history: sign-ins, failed attempts, and changes
 * to password, 2FA and devices. Append-only; rows expire after 90 days.
 */
export interface SecurityEvent {
  userId: Types.ObjectId;
  type: SecurityEventType;
  /** The sign-in it happened in; empty for failed sign-ins. */
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  createdAt: Date;
}

const RETENTION_DAYS = 90;
const LIST_LIMIT = 30;

const securityEventSchema = new Schema<SecurityEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    sessionId: String,
    userAgent: String,
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

securityEventSchema.index({ userId: 1, createdAt: -1 });
// TTL index: MongoDB deletes rows once they are older than the retention period.
securityEventSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: RETENTION_DAYS * 86_400 },
);

export const SecurityEventModel = model<SecurityEvent>(
  'SecurityEvent',
  securityEventSchema,
);

/** Where an event came from: the device and, when signed in, the session. */
export interface EventContext {
  sessionId?: string;
  userAgent?: string;
  ip?: string;
}

/** Security events the user is also told about (in-app notification). */
const NOTIFIED: Partial<Record<SecurityEventType, NotificationType>> = {
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  MFA_ENABLED: 'MFA_ENABLED',
  MFA_DISABLED: 'MFA_DISABLED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  STOLEN_SESSION_BLOCKED: 'STOLEN_SESSION_BLOCKED',
};

export async function recordSecurityEvent(
  userId: string | Types.ObjectId,
  type: SecurityEventType,
  context: EventContext = {},
): Promise<void> {
  // Checked before the new sign-in is recorded, so it doesn't count itself.
  const newDevice =
    type === 'SIGNED_IN' && (await isNewDevice(userId, context));
  await SecurityEventModel.create({ userId, type, ...context });

  const notification = newDevice ? 'NEW_DEVICE_SIGN_IN' : NOTIFIED[type];
  // The shared demo login gets none: visitors would see each other's devices.
  if (notification && !(await isDemoAccount(userId))) {
    await notify(
      userId,
      notification,
      notification === 'NEW_DEVICE_SIGN_IN'
        ? { userAgent: context.userAgent ?? '' }
        : {},
    );
  }
}

/**
 * A sign-in from a browser (User-Agent) this user hasn't signed in from in
 * the last 90 days. The very first sign-in (registering) is not news.
 */
async function isNewDevice(
  userId: string | Types.ObjectId,
  { userAgent }: EventContext,
): Promise<boolean> {
  const signIns = { userId, type: 'SIGNED_IN' as const };
  const [before, sameDevice] = await Promise.all([
    SecurityEventModel.exists(signIns),
    SecurityEventModel.exists({ ...signIns, userAgent }),
  ]);
  return !!before && !sameDevice;
}

/**
 * The newest events first. A shared demo login sees only its own session's
 * events: other visitors' devices and IP addresses stay private.
 */
export async function listSecurityEvents(
  userId: string,
  currentSessionId: string,
): Promise<SecurityEventDto[]> {
  const onlyCurrent = await isDemoAccount(userId);
  const events = await SecurityEventModel.find({
    userId,
    ...(onlyCurrent && { sessionId: currentSessionId }),
  })
    .sort({ createdAt: -1 })
    .limit(LIST_LIMIT);

  return events.map((e) => ({
    id: e.id,
    type: e.type,
    userAgent: e.userAgent ?? '',
    ip: e.ip ?? '',
    createdAt: e.createdAt.toISOString(),
    current: !!e.sessionId && e.sessionId === currentSessionId,
  }));
}
