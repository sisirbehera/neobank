import mongoose, { isValidObjectId, Types } from 'mongoose';
import type {
  AccountDto,
  AdminStats,
  AdminTransactionRow,
  AdminTransactionsQuerySchema,
  AdminUserDetail,
  AdminUserRow,
  AdminUsersQuerySchema,
  AuditEntryDto,
  Page,
  UpdateAccountStatusRequestSchema,
} from '@neobank/shared/models';
import { maskAccountNumber } from '@neobank/shared/utils';
import type { z } from 'zod';
import { HttpError } from '../../lib/http-error';
import { istDay, startOfIstDay } from '../../lib/ist';
import { escapeRegex } from '../../lib/regex';
import { AccountModel, toAccountDto } from '../accounts/account.model';
import { TransactionModel } from '../transactions/transaction.model';
import { UserModel } from '../users/user.model';
import { AuditLogModel } from './audit-log.model';

type UsersQuery = z.output<typeof AdminUsersQuerySchema>;
type TransactionsQuery = z.output<typeof AdminTransactionsQuerySchema>;
type StatusUpdate = z.output<typeof UpdateAccountStatusRequestSchema>;

export class AdminService {
  async stats(): Promise<AdminStats> {
    const today = startOfIstDay(istDay());
    const [users, accounts, frozenAccounts, balance, todays] =
      await Promise.all([
        UserModel.countDocuments(),
        AccountModel.countDocuments({ status: { $ne: 'CLOSED' } }),
        AccountModel.countDocuments({ status: 'FROZEN' }),
        AccountModel.aggregate<{ total: number }>([
          { $group: { _id: null, total: { $sum: '$balance' } } },
        ]),
        TransactionModel.aggregate<{ count: number; volume: number }>([
          { $match: { createdAt: { $gte: today } } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              volume: { $sum: '$amount' },
            },
          },
        ]),
      ]);
    return {
      users,
      accounts,
      frozenAccounts,
      totalBalance: balance[0]?.total ?? 0,
      transactionsToday: todays[0]?.count ?? 0,
      volumeTodayPaise: todays[0]?.volume ?? 0,
    };
  }

  async users(query: UsersQuery): Promise<Page<AdminUserRow>> {
    const filter = query.q
      ? {
          $or: [
            { name: new RegExp(escapeRegex(query.q), 'i') },
            { email: new RegExp(escapeRegex(query.q), 'i') },
          ],
        }
      : {};
    const [users, total] = await Promise.all([
      UserModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize),
      UserModel.countDocuments(filter),
    ]);

    // Account count and total balance for just this page of users.
    const totals = await AccountModel.aggregate<{
      _id: Types.ObjectId;
      count: number;
      balance: number;
    }>([
      {
        $match: {
          userId: { $in: users.map((u) => u._id) },
          status: { $ne: 'CLOSED' },
        },
      },
      {
        $group: {
          _id: '$userId',
          count: { $sum: 1 },
          balance: { $sum: '$balance' },
        },
      },
    ]);
    const byUser = new Map(totals.map((t) => [t._id.toString(), t]));

    return {
      items: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        accountCount: byUser.get(u.id)?.count ?? 0,
        totalBalance: byUser.get(u.id)?.balance ?? 0,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async user(id: string): Promise<AdminUserDetail> {
    if (!isValidObjectId(id)) throw HttpError.notFound('User not found');
    const user = await UserModel.findById(id);
    if (!user) throw HttpError.notFound('User not found');
    const accounts = await AccountModel.find({ userId: id }).sort({
      createdAt: 1,
    });
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
      accounts: accounts.map(toAccountDto),
    };
  }

  /** Freeze or unfreeze an account; the change and its audit entry commit together. */
  async setAccountStatus(
    adminId: string,
    accountId: string,
    { status, reason }: StatusUpdate,
  ): Promise<AccountDto> {
    if (!isValidObjectId(accountId))
      throw HttpError.notFound('Account not found');

    return mongoose.connection.transaction(async (session) => {
      const account = await AccountModel.findById(accountId).session(session);
      if (!account) throw HttpError.notFound('Account not found');
      if (account.status === 'CLOSED') {
        throw HttpError.conflict(
          'Closed accounts cannot be changed',
          'ACCOUNT_CLOSED',
        );
      }
      if (account.status === status) {
        throw HttpError.conflict(
          `Account is already ${status.toLowerCase()}`,
          'NO_CHANGE',
        );
      }

      account.status = status;
      await account.save({ session });

      const owner = await UserModel.findById(account.userId).session(session);
      await AuditLogModel.create(
        [
          {
            adminId,
            action: status === 'FROZEN' ? 'ACCOUNT_FROZEN' : 'ACCOUNT_UNFROZEN',
            target: `${maskAccountNumber(account.accountNumber)} (${owner?.name ?? 'unknown'})`,
            reason,
          },
        ],
        { session },
      );
      return toAccountDto(account);
    });
  }

  async transactions(
    query: TransactionsQuery,
  ): Promise<Page<AdminTransactionRow>> {
    const filter = query.type ? { type: query.type } : {};
    const [transactions, total] = await Promise.all([
      TransactionModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize)
        .populate<{ fromAccountId: { accountNumber: string } | null }>(
          'fromAccountId',
          'accountNumber',
        )
        .populate<{ toAccountId: { accountNumber: string } | null }>(
          'toAccountId',
          'accountNumber',
        )
        .populate<{ initiatedBy: { name: string } | null }>(
          'initiatedBy',
          'name',
        ),
      TransactionModel.countDocuments(filter),
    ]);

    return {
      items: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        fromAccountNumber: t.fromAccountId?.accountNumber ?? null,
        toAccountNumber: t.toAccountId?.accountNumber ?? null,
        initiatedBy: t.initiatedBy?.name ?? 'deleted user',
        isExternal: t.isExternal ?? false,
        createdAt: t.createdAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async audit(limit = 20): Promise<AuditEntryDto[]> {
    const entries = await AuditLogModel.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate<{ adminId: { name: string } | null }>('adminId', 'name');
    return entries.map((e) => ({
      id: e.id,
      adminName: e.adminId?.name ?? 'deleted admin',
      action: e.action,
      target: e.target,
      reason: e.reason,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  async record(adminId: string, action: string, target: string, reason = '') {
    await AuditLogModel.create({ adminId, action, target, reason });
  }
}
