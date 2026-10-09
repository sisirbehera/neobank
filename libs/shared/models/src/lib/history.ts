import * as z from 'zod/mini';
import {
  AccountDtoSchema,
  LedgerDirectionSchema,
  LedgerEntryDtoSchema,
  TransactionTypeSchema,
} from './accounts';
import { UserRoleSchema } from './auth';
import { PaiseSchema } from './money';

/** Query-string values arrive as strings; treat "" like "not given". */
const optional = <T extends z.ZodMiniType>(schema: T) =>
  z.pipe(
    z.transform((v: unknown) => (v === '' ? undefined : v)),
    z.optional(schema),
  );

/** "?page=2" → 2, with a default and bounds. */
const queryInt = (fallback: number, max: number) =>
  z._default(
    z.pipe(z.coerce.number(), z.int().check(z.minimum(1), z.maximum(max))),
    fallback,
  );

const PageSchema = queryInt(1, 100_000);
const PageSizeSchema = queryInt(20, 100);

/** A page of results plus the total, for pagination controls. */
export const pageOf = <T extends z.ZodMiniType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.int(),
    pageSize: z.int(),
    total: z.int(),
  });

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

const SearchSchema = z.string().check(z.trim(), z.maxLength(50));

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
    q: optional(SearchSchema),
    page: PageSchema,
    pageSize: PageSizeSchema,
  })
  .check(
    z.refine(
      (q) => !q.from || !q.to || (q.from as string) <= (q.to as string),
      { error: '"From" must be on or before "To"', path: ['to'] },
    ),
  );
export type HistoryQuery = z.input<typeof HistoryQuerySchema>;

export const HistoryPageSchema = pageOf(LedgerEntryDtoSchema);
export type HistoryPage = z.infer<typeof HistoryPageSchema>;

/** Money in and out per calendar month (IST); own-account transfers excluded. */
export const MonthlySummarySchema = z.array(
  z.object({
    month: z.string().check(z.regex(/^\d{4}-\d{2}$/)),
    inPaise: PaiseSchema,
    outPaise: PaiseSchema,
  }),
);
export type MonthlySummary = z.infer<typeof MonthlySummarySchema>;

// ---- Admin ------------------------------------------------------------------

export const AdminStatsSchema = z.object({
  users: z.int(),
  accounts: z.int(),
  frozenAccounts: z.int(),
  /** Sum of all customer balances, in paise. */
  totalBalance: PaiseSchema,
  transactionsToday: z.int(),
  volumeTodayPaise: PaiseSchema,
});
export type AdminStats = z.infer<typeof AdminStatsSchema>;

export const AdminUsersQuerySchema = z.object({
  q: optional(SearchSchema),
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
  accountCount: z.int(),
  totalBalance: PaiseSchema,
});
export type AdminUserRow = z.infer<typeof AdminUserRowSchema>;
export const AdminUsersPageSchema = pageOf(AdminUserRowSchema);

export const AdminUserDetailSchema = z.object({
  user: z.omit(AdminUserRowSchema, { accountCount: true, totalBalance: true }),
  accounts: z.array(AccountDtoSchema),
});
export type AdminUserDetail = z.infer<typeof AdminUserDetailSchema>;

export const UpdateAccountStatusRequestSchema = z.object({
  // Admins can freeze and unfreeze; closing accounts isn't offered.
  status: z.enum(['ACTIVE', 'FROZEN']),
  reason: z
    .string()
    .check(
      z.trim(),
      z.minLength(3, 'Give a short reason (at least 3 characters)'),
      z.maxLength(200, 'Reason must be at most 200 characters'),
    ),
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
  fromAccountNumber: z.nullable(z.string()),
  toAccountNumber: z.nullable(z.string()),
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
