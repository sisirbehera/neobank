import { randomInt } from 'node:crypto';
import { isValidObjectId } from 'mongoose';
import {
  type AccountDto,
  type LedgerEntryDto,
  MAX_ACCOUNTS_PER_USER,
  type MoneyMovementRequestSchema,
  type MoneyMovementResponse,
  type OpenAccountRequestSchema,
} from '@neobank/shared/models';
import { buildAccountNumber } from '@neobank/shared/utils';
import type { z } from 'zod';
import { HttpError } from '../../lib/http-error';
import { isDuplicateKey } from '../../lib/mongo-errors';
import {
  type IdempotentOutcome,
  runIdempotent,
} from '../idempotency/idempotency';
import {
  LedgerEntryModel,
  toLedgerEntryDto,
} from '../transactions/ledger-entry.model';
import {
  accountNotFound,
  creditOwnAccount,
  debitOwnAccount,
} from '../transactions/posting';
import { TransactionModel } from '../transactions/transaction.model';
import { AccountModel, toAccountDto } from './account.model';

type OpenAccountInput = z.output<typeof OpenAccountRequestSchema>;
type MovementInput = z.output<typeof MoneyMovementRequestSchema>;

export class AccountsService {
  async list(userId: string): Promise<AccountDto[]> {
    const accounts = await AccountModel.find({
      userId,
      status: { $ne: 'CLOSED' },
    }).sort({ createdAt: 1 });
    return accounts.map(toAccountDto);
  }

  async get(userId: string, accountId: string): Promise<AccountDto> {
    // Someone else's account is reported as "not found", never "forbidden",
    // so ids can't be probed to discover which accounts exist.
    if (!isValidObjectId(accountId)) throw accountNotFound();
    const account = await AccountModel.findOne({ _id: accountId, userId });
    if (!account) throw accountNotFound();
    return toAccountDto(account);
  }

  async open(userId: string, input: OpenAccountInput): Promise<AccountDto> {
    const count = await AccountModel.countDocuments({
      userId,
      status: { $ne: 'CLOSED' },
    });
    if (count >= MAX_ACCOUNTS_PER_USER) {
      throw HttpError.conflict(
        `You can have at most ${MAX_ACCOUNTS_PER_USER} accounts`,
        'ACCOUNT_LIMIT',
      );
    }

    // Random numbers can collide; the unique index tells us, and we retry.
    for (let attempt = 0; attempt < 5; attempt++) {
      const accountNumber = buildAccountNumber(
        randomInt(0, 1_000_000_000).toString().padStart(9, '0'),
      );
      try {
        const account = await AccountModel.create({
          userId,
          accountNumber,
          type: input.type,
          nickname: input.nickname,
        });
        return toAccountDto(account);
      } catch (err) {
        if (!isDuplicateKey(err, 'accountNumber')) throw err;
      }
    }
    throw new Error('Could not generate a unique account number');
  }

  deposit(
    userId: string,
    accountId: string,
    input: MovementInput,
    key: string,
  ) {
    return this.move('DEPOSIT', userId, accountId, input, key);
  }

  withdraw(
    userId: string,
    accountId: string,
    input: MovementInput,
    key: string,
  ) {
    return this.move('WITHDRAWAL', userId, accountId, input, key);
  }

  /** Newest ledger entries across the user's accounts, or for one account. */
  async activity(
    userId: string,
    options: { accountId?: string; limit: number },
  ): Promise<LedgerEntryDto[]> {
    let accountIds;
    if (options.accountId) {
      accountIds = [(await this.get(userId, options.accountId)).id];
    } else {
      accountIds = await AccountModel.find({ userId }).distinct('_id');
    }

    const entries = await LedgerEntryModel.find({
      accountId: { $in: accountIds },
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(options.limit);
    return entries.map(toLedgerEntryDto);
  }

  /**
   * Deposit or withdrawal. The balance update, the transaction and the ledger
   * entry are written in ONE MongoDB transaction (inside runIdempotent):
   * either all of them are saved, or none are.
   */
  private async move(
    type: 'DEPOSIT' | 'WITHDRAWAL',
    userId: string,
    accountId: string,
    input: MovementInput,
    key: string,
  ): Promise<IdempotentOutcome<MoneyMovementResponse>> {
    if (!isValidObjectId(accountId)) throw accountNotFound();
    const isDeposit = type === 'DEPOSIT';
    const { amountPaise, description } = input;

    return runIdempotent(
      { userId, key, scope: `${type}:${accountId}`, request: input },
      async (session) => {
        const posting = { accountId, userId, amount: amountPaise };
        const account = isDeposit
          ? await creditOwnAccount(session, posting)
          : await debitOwnAccount(session, posting);

        const [transaction] = await TransactionModel.create(
          [
            {
              type,
              [isDeposit ? 'toAccountId' : 'fromAccountId']: account._id,
              amount: amountPaise,
              description,
              initiatedBy: userId,
            },
          ],
          { session },
        );

        const [entry] = await LedgerEntryModel.create(
          [
            {
              transactionId: transaction._id,
              accountId: account._id,
              type,
              direction: isDeposit ? 'CREDIT' : 'DEBIT',
              amount: amountPaise,
              balanceAfter: account.balance,
              description,
            },
          ],
          { session },
        );

        return {
          account: toAccountDto(account),
          entry: toLedgerEntryDto(entry),
        };
      },
    );
  }
}
