import {
  type ClientSession,
  isValidObjectId,
  model,
  Schema,
  Types,
} from 'mongoose';
import type {
  NotificationDto,
  NotificationsPage,
  NotificationSummary,
  NotificationType,
} from '@neobank/shared/models';
import { HttpError } from '../../lib/http-error';

/**
 * In-app notifications: a type plus values, worded by the web app in the
 * reader's language (decision record 0014). Rows expire after 90 days.
 */
export interface Notification {
  userId: Types.ObjectId;
  type: NotificationType;
  data: Record<string, string>;
  readAt?: Date;
  createdAt: Date;
}

const RETENTION_DAYS = 90;
const LIST_LIMIT = 20;

const notificationSchema = new Schema<Notification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    data: { type: Map, of: String, default: {} },
    readAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// The list (newest first) and the unread count both start from the user.
notificationSchema.index({ userId: 1, createdAt: -1 });
// Unread count: a missing readAt is indexed as null.
notificationSchema.index({ userId: 1, readAt: 1 });
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: RETENTION_DAYS * 86_400 },
);

export const NotificationModel = model<Notification>(
  'Notification',
  notificationSchema,
);

/**
 * Creates a notification. Pass the session of a running transaction to make
 * it part of it: a "money received" notification exists exactly when the
 * money arrived.
 */
export async function notify(
  userId: string | Types.ObjectId,
  type: NotificationType,
  data: Record<string, string> = {},
  session?: ClientSession,
): Promise<void> {
  await NotificationModel.create([{ userId, type, data }], { session });
}

function toDto(n: InstanceType<typeof NotificationModel>): NotificationDto {
  return {
    id: n.id,
    type: n.type,
    data: Object.fromEntries(
      n.data instanceof Map ? n.data : Object.entries(n.data ?? {}),
    ),
    read: !!n.readAt,
    createdAt: n.createdAt.toISOString(),
  };
}

const unread = (userId: string) => ({ userId, readAt: null });

export class NotificationsService {
  async list(userId: string): Promise<NotificationsPage> {
    const [items, unreadCount] = await Promise.all([
      NotificationModel.find({ userId })
        .sort({ createdAt: -1 })
        .limit(LIST_LIMIT),
      NotificationModel.countDocuments(unread(userId)),
    ]);
    return { items: items.map(toDto), unreadCount };
  }

  async summary(userId: string): Promise<NotificationSummary> {
    const [latest, unreadCount] = await Promise.all([
      NotificationModel.findOne({ userId })
        .sort({ createdAt: -1 })
        .select('_id'),
      NotificationModel.countDocuments(unread(userId)),
    ]);
    return { unreadCount, latestId: latest?.id ?? null };
  }

  async markRead(userId: string, id: string): Promise<void> {
    if (!isValidObjectId(id))
      throw HttpError.notFound('Notification not found');
    // Matching the user too: one user can't touch another's notifications.
    // Reading an already-read notification keeps its first readAt.
    const { matchedCount } = await NotificationModel.updateOne(
      { _id: id, userId, readAt: null },
      { $set: { readAt: new Date() } },
    );
    if (
      matchedCount === 0 &&
      !(await NotificationModel.exists({ _id: id, userId }))
    ) {
      throw HttpError.notFound('Notification not found');
    }
  }

  async markAllRead(userId: string): Promise<void> {
    await NotificationModel.updateMany(unread(userId), {
      $set: { readAt: new Date() },
    });
  }
}
