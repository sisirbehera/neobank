import * as z from 'zod/mini';

/**
 * What a notification is about. Stored as a type plus values (`data`), never
 * as a sentence: the web app words it in the reader's language
 * (decision record 0014).
 */
export const NotificationTypeSchema = z.enum([
  /** data: amountPaise, from (sender's name), accountId, account (masked) */
  'MONEY_RECEIVED',
  /** data: userAgent */
  'NEW_DEVICE_SIGN_IN',
  'PASSWORD_CHANGED',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'ACCOUNT_LOCKED',
  'STOLEN_SESSION_BLOCKED',
  /** data: accountId, account (masked) */
  'ACCOUNT_FROZEN',
  /** data: accountId, account (masked) */
  'ACCOUNT_UNFROZEN',
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationDtoSchema = z.object({
  id: z.string(),
  type: NotificationTypeSchema,
  data: z.record(z.string(), z.string()),
  read: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type NotificationDto = z.infer<typeof NotificationDtoSchema>;

/** The newest notifications and how many are unread. */
export const NotificationsPageSchema = z.object({
  items: z.array(NotificationDtoSchema),
  unreadCount: z.int(),
});
export type NotificationsPage = z.infer<typeof NotificationsPageSchema>;

/** Cheap enough to ask for every minute: is there anything new? */
export const NotificationSummarySchema = z.object({
  unreadCount: z.int(),
  /** Newest notification's id: when it changes, something new arrived. */
  latestId: z.nullable(z.string()),
});
export type NotificationSummary = z.infer<typeof NotificationSummarySchema>;
