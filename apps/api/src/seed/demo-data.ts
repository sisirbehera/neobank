import { randomInt } from 'node:crypto';
import { Types } from 'mongoose';
import {
  type AccountType,
  DEMO_LOGIN,
  type TransactionType,
} from '@neobank/shared/models';
import { buildAccountNumber, maskAccountNumber } from '@neobank/shared/utils';
import { lastIstMonths } from '../lib/ist';
import { AccountModel } from '../modules/accounts/account.model';
import { hashPassword } from '../modules/auth/password';
import { RefreshTokenModel } from '../modules/auth/refresh-token.model';
import { BeneficiaryModel } from '../modules/beneficiaries/beneficiary.model';
import { IdempotencyRecordModel } from '../modules/idempotency/idempotency-record.model';
import { LedgerEntryModel } from '../modules/transactions/ledger-entry.model';
import { TransactionModel } from '../modules/transactions/transaction.model';
import { DailyTransferUsageModel } from '../modules/transfers/daily-limit.model';
import { UserModel } from '../modules/users/user.model';

/** Public demo logins (shown on the login page in demo mode). */
export const DEMO_USERS = {
  demo: { name: 'Priya Sharma', ...DEMO_LOGIN },
  friend: {
    name: 'Ravi Kumar',
    email: 'ravi@neobank.dev',
    password: DEMO_LOGIN.password,
  },
} as const;

const DEMO_EMAILS = [DEMO_USERS.demo.email, DEMO_USERS.friend.email];

/**
 * Creates the demo users with ~6 months of history, unless they already exist.
 * With `reset`, deletes the demo users and everything they own first.
 */
export async function seedDemoData({ reset = false } = {}): Promise<void> {
  if (reset) await deleteDemoData();
  else if (await UserModel.exists({ email: DEMO_USERS.demo.email })) {
    // Demo users created before the `demo` flag existed get it now.
    await UserModel.updateMany(
      { email: { $in: DEMO_EMAILS } },
      { $set: { demo: true } },
    );
    return;
  }

  const passwordHash = await hashPassword(DEMO_USERS.demo.password);
  const [priya, ravi] = await UserModel.create([
    { ...demoUser(DEMO_USERS.demo), passwordHash },
    { ...demoUser(DEMO_USERS.friend), passwordHash },
  ]);

  const openAccount = (
    userId: Types.ObjectId,
    type: AccountType,
    nickname: string,
  ) =>
    AccountModel.create({
      userId,
      type,
      nickname,
      accountNumber: buildAccountNumber(
        randomInt(0, 1_000_000_000).toString().padStart(9, '0'),
      ),
    });
  const savings = await openAccount(priya._id, 'SAVINGS', 'Salary account');
  const current = await openAccount(priya._id, 'CURRENT', 'Everyday spending');
  const raviSavings = await openAccount(ravi._id, 'SAVINGS', '');

  await BeneficiaryModel.create([
    {
      userId: priya._id,
      name: ravi.name,
      accountNumber: raviSavings.accountNumber,
      nickname: 'Flatmate',
    },
    {
      userId: ravi._id,
      name: priya.name,
      accountNumber: savings.accountNumber,
    },
  ]);

  // ---- Build the event list ------------------------------------------------
  type Ref = typeof savings;
  interface Event {
    at: Date;
    type: TransactionType;
    from?: Ref;
    to?: Ref;
    amount: number; // paise
    description: string;
    by: Types.ObjectId;
  }
  const events: Event[] = [];
  const now = new Date();

  lastIstMonths(6).forEach((month, i) => {
    const at = (day: number, time: string) =>
      new Date(`${month}-${String(day).padStart(2, '0')}T${time}:00+05:30`);
    const add = (e: Event) => e.at <= now && events.push(e);

    add({
      at: at(1, '10:00'),
      type: 'DEPOSIT',
      to: savings,
      amount: 85_000_00,
      description: 'Salary – Acme Corp',
      by: priya._id,
    });
    add({
      at: at(1, '11:00'),
      type: 'DEPOSIT',
      to: raviSavings,
      amount: 60_000_00,
      description: 'Salary – Globex',
      by: ravi._id,
    });
    add({
      at: at(3, '09:30'),
      type: 'TRANSFER',
      from: savings,
      to: current,
      amount: 30_000_00,
      description: 'Monthly budget',
      by: priya._id,
    });
    add({
      at: at(5, '19:00'),
      type: 'TRANSFER',
      from: current,
      to: raviSavings,
      amount: 12_000_00,
      description: 'Rent share',
      by: priya._id,
    });
    add({
      at: at(9, '18:15'),
      type: 'WITHDRAWAL',
      from: current,
      amount: 3_000_00 + i * 250_00 + 75,
      description: 'Groceries',
      by: priya._id,
    });
    add({
      at: at(14, '20:30'),
      type: 'TRANSFER',
      from: raviSavings,
      to: savings,
      amount: 1_500_00 + i * 100_00,
      description: 'Dinner split',
      by: ravi._id,
    });
    add({
      at: at(20, '12:00'),
      type: 'WITHDRAWAL',
      from: current,
      amount: 2_000_00,
      description: 'ATM',
      by: priya._id,
    });
    add({
      at: at(26, '21:00'),
      type: 'WITHDRAWAL',
      from: savings,
      amount: 1_800_00 + i * 60_00,
      description: 'Electricity bill',
      by: priya._id,
    });
  });
  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  // ---- Replay events into transactions + ledger entries -----------------------
  const balances = new Map<string, number>();
  const owners = new Map([
    [priya.id, priya.name],
    [ravi.id, ravi.name],
  ]);
  const label = (account: Ref, asSeenBy: Ref) =>
    account.userId.equals(asSeenBy.userId)
      ? `${account.type === 'SAVINGS' ? 'Savings' : 'Current'} · ${maskAccountNumber(account.accountNumber)}`
      : `${owners.get(account.userId.toString())} · ${maskAccountNumber(account.accountNumber)}`;

  const transactions = [];
  const entries: Record<string, unknown>[] = [];
  for (const e of events) {
    const transactionId = new Types.ObjectId();
    const internal = !!e.from && !!e.to && e.from.userId.equals(e.to.userId);
    transactions.push({
      _id: transactionId,
      type: e.type,
      fromAccountId: e.from?._id,
      toAccountId: e.to?._id,
      amount: e.amount,
      description: e.description,
      status: 'COMPLETED',
      initiatedBy: e.by,
      isExternal: e.type === 'TRANSFER' && !internal,
      createdAt: e.at,
    });

    const post = (account: Ref, direction: 'DEBIT' | 'CREDIT', other?: Ref) => {
      const before = balances.get(account.id) ?? 0;
      const after = before + (direction === 'CREDIT' ? e.amount : -e.amount);
      if (after < 0)
        throw new Error(`Seed would overdraw ${account.accountNumber}`);
      balances.set(account.id, after);
      entries.push({
        transactionId,
        accountId: account._id,
        type: e.type,
        direction,
        amount: e.amount,
        balanceAfter: after,
        description: e.description,
        counterparty: other ? label(other, account) : '',
        internal,
        createdAt: e.at,
      });
    };
    if (e.from) post(e.from, 'DEBIT', e.to);
    if (e.to) post(e.to, 'CREDIT', e.from);
  }

  // Raw inserts keep the historical createdAt dates.
  if (transactions.length)
    await TransactionModel.collection.insertMany(transactions);
  if (entries.length) await LedgerEntryModel.collection.insertMany(entries);
  await Promise.all(
    [savings, current, raviSavings].map((a) =>
      AccountModel.updateOne(
        { _id: a._id },
        { balance: balances.get(a.id) ?? 0 },
      ),
    ),
  );
}

/** Creates the admin user, or promotes an existing user with that email. */
export async function ensureAdmin(
  email: string,
  password: string,
): Promise<void> {
  const existing = await UserModel.findOne({ email: email.toLowerCase() });
  if (existing) {
    if (existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
    }
    return;
  }
  await UserModel.create({
    name: 'NeoBank Admin',
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password),
    role: 'admin',
  });
}

async function deleteDemoData(): Promise<void> {
  const users = await UserModel.find({ email: { $in: DEMO_EMAILS } });
  const userIds = users.map((u) => u._id);
  const accounts = await AccountModel.find({ userId: { $in: userIds } });
  const accountIds = accounts.map((a) => a._id);

  await Promise.all([
    LedgerEntryModel.deleteMany({ accountId: { $in: accountIds } }),
    TransactionModel.deleteMany({
      $or: [
        { fromAccountId: { $in: accountIds } },
        { toAccountId: { $in: accountIds } },
      ],
    }),
    BeneficiaryModel.deleteMany({
      $or: [
        { userId: { $in: userIds } },
        { accountNumber: { $in: accounts.map((a) => a.accountNumber) } },
      ],
    }),
    RefreshTokenModel.deleteMany({ userId: { $in: userIds } }),
    IdempotencyRecordModel.deleteMany({ userId: { $in: userIds } }),
    DailyTransferUsageModel.deleteMany({ userId: { $in: userIds } }),
  ]);
  await AccountModel.deleteMany({ _id: { $in: accountIds } });
  await UserModel.deleteMany({ _id: { $in: userIds } });
}

function demoUser({ name, email }: { name: string; email: string }) {
  return { name, email, demo: true };
}
