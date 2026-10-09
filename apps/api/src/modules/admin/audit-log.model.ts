import { HydratedDocument, model, Schema, Types } from 'mongoose';

/**
 * Who did what, when and why. Every admin action that changes data is
 * recorded here (append-only), in the same transaction as the change.
 */
export interface AuditLog {
  adminId: Types.ObjectId;
  /** e.g. ACCOUNT_FROZEN, ACCOUNT_UNFROZEN, DEMO_RESET */
  action: string;
  /** Human-readable description of what was changed. */
  target: string;
  reason: string;
  createdAt: Date;
}

export type AuditLogDocument = HydratedDocument<AuditLog>;

const auditLogSchema = new Schema<AuditLog>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    target: { type: String, required: true },
    reason: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });

export const AuditLogModel = model<AuditLog>('AuditLog', auditLogSchema);
