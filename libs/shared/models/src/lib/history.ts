import { z } from 'zod';
import {
  AccountDtoSchema,
  AccountStatusSchema,
  LedgerDirectionSchema,
  LedgerEntryDtoSchema,
  TransactionTypeSchema,
} from './accounts';
import { UserRoleSchema } from './auth';
import { PaiseSchema } from './money';

/** Query-string values arrive as strings; treat "" like "not given". */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const PageSchema = z.coerce.number().int().min(1).default(1);
const PageSizeSchema = z.coerce.number().int().min(1).max(100).default(20);

/** A page of results plus the total, for pagination controls. */
export const pageOf = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

// ---- Transaction history (customer) -----------------------------------------

export const HistoryQuerySchema = z
  .object({
    accountId: optional(z.string()),
    type: optional(TransactionTypeSchema),
    direction: optional(LedgerDirectionSchema),
    /** Inclusive calendar dates (IST), "YYYY-MM-DD". */
    from: optional(z.iso.date('Use the format YYYY-MM-DD')),
    to: optional(z.iso.date('Use the format YYYY-MM-DD')),
    /** Searches description and counterparty. */
    q: optional(z.string().trim().max(50)),
    page: PageSchema,
    pageSize: PageSizeSchema,
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: '"From" must be on or before "To"',
    path: ['to'],
  });
export type HistoryQuery = z.input<typeof HistoryQuerySchema>;

export const HistoryPageSchema = pageOf(LedgerEntryDtoSchema);
export type HistoryPage = z.infer<typeof HistoryPageSchema>;

/** Money in and out per calendar month (IST); own-account transfers excluded. */
export const MonthlySummarySchema = z.array(
  z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    inPaise: PaiseSchema,
    outPaise: PaiseSchema,
  }),
);
export type MonthlySummary = z.infer<typeof MonthlySummarySchema>;

// ---- Admin ------------------------------------------------------------------

export const AdminStatsSchema = z.object({
  users: z.number().int(),
  accounts: z.number().int(),
  frozenAccounts: z.number().int(),
  /** Sum of all customer balances, in paise. */
  totalBalance: PaiseSchema,
  transactionsToday: z.number().int(),
  volumeTodayPaise: PaiseSchema,
});
export type AdminStats = z.infer<typeof AdminStatsSchema>;

export const AdminUsersQuerySchema = z.object({
  q: optional(z.string().trim().max(50)),
  page: PageSchema,
  pageSize: PageSizeSchema,
});
export type AdminUsersQuery = z.input<typeof AdminUsersQuerySchema>;

export const AdminUserRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: UserRoleSchema,
  createdAt: z.iso.datetime(),
  accountCount: z.number().int(),
  totalBalance: PaiseSchema,
});
export type AdminUserRow = z.infer<typeof AdminUserRowSchema>;
export const AdminUsersPageSchema = pageOf(AdminUserRowSchema);

export const AdminUserDetailSchema = z.object({
  user: AdminUserRowSchema.omit({ accountCount: true, totalBalance: true }),
  accounts: z.array(AccountDtoSchema),
});
export type AdminUserDetail = z.infer<typeof AdminUserDetailSchema>;

export const UpdateAccountStatusRequestSchema = z.object({
  status: AccountStatusSchema.exclude(['CLOSED']),
  reason: z
    .string()
    .trim()
    .min(3, 'Give a short reason (at least 3 characters)')
    .max(200, 'Reason must be at most 200 characters'),
});
export type UpdateAccountStatusRequest = z.input<
  typeof UpdateAccountStatusRequestSchema
>;

export const AdminTransactionsQuerySchema = z.object({
  type: optional(TransactionTypeSchema),
  page: PageSchema,
  pageSize: PageSizeSchema,
});
export type AdminTransactionsQuery = z.input<
  typeof AdminTransactionsQuerySchema
>;

export const AdminTransactionRowSchema = z.object({
  id: z.string(),
  type: TransactionTypeSchema,
  amount: PaiseSchema,
  description: z.string(),
  fromAccountNumber: z.string().nullable(),
  toAccountNumber: z.string().nullable(),
  initiatedBy: z.string(),
  isExternal: z.boolean(),
  createdAt: z.iso.datetime(),
});
export type AdminTransactionRow = z.infer<typeof AdminTransactionRowSchema>;
export const AdminTransactionsPageSchema = pageOf(AdminTransactionRowSchema);

export const AuditEntryDtoSchema = z.object({
  id: z.string(),
  adminName: z.string(),
  action: z.string(),
  target: z.string(),
  reason: z.string(),
  createdAt: z.iso.datetime(),
});
export type AuditEntryDto = z.infer<typeof AuditEntryDtoSchema>;
