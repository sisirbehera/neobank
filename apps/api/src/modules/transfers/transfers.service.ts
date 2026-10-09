import { isValidObjectId } from 'mongoose';
import type {
  AccountType,
  TransferRequestSchema,
  TransferResponse,
} from '@neobank/shared/models';
import { maskAccountNumber } from '@neobank/shared/utils';
import type { z } from 'zod';
import { HttpError } from '../../lib/http-error';
import { AccountModel, toAccountDto } from '../accounts/account.model';
import { BeneficiaryModel } from '../beneficiaries/beneficiary.model';
import {
  type IdempotentOutcome,
  runIdempotent,
} from '../idempotency/idempotency';
import {
  LedgerEntryModel,
  toLedgerEntryDto,
} from '../transactions/ledger-entry.model';
import { accountNotFound, debitOwnAccount } from '../transactions/posting';
import { TransactionModel } from '../transactions/transaction.model';
import { UserModel } from '../users/user.model';
import { consumeDailyLimit } from './daily-limit';

type TransferInput = z.output<typeof TransferRequestSchema>;

const TYPE_LABEL: Record<AccountType, string> = {
  SAVINGS: 'Savings',
  CURRENT: 'Current',
};

const recipientUnavailable = () =>
  HttpError.conflict(
    'The receiving account cannot accept money right now',
    'RECIPIENT_NOT_ACTIVE',
  );

export class TransfersService {
  /**
   * Moves money from one of the user's accounts to another account.
   *
   * Everything (debit, credit, daily limit, transaction, both ledger entries,
   * idempotency record) happens in one MongoDB transaction. If any step
   * throws, nothing is saved: the payer is never debited without the payee
   * being credited.
   */
  transfer(
    userId: string,
    input: TransferInput,
    key: string,
  ): Promise<IdempotentOutcome<TransferResponse>> {
    if (!isValidObjectId(input.fromAccountId)) throw accountNotFound();

    return runIdempotent(
      { userId, key, scope: 'TRANSFER', request: input },
      async (session) => {
        const from = await AccountModel.findOne({
          _id: input.fromAccountId,
          userId,
        }).session(session);
        if (!from) throw accountNotFound();

        const to = await AccountModel.findOne({
          accountNumber: input.toAccountNumber,
        }).session(session);
        const isOwn = !!to && to.userId.equals(userId);

        if (to && to.id === from.id) {
          throw HttpError.badRequest('Choose a different account to pay into');
        }

        // Money can only go to your own accounts or to saved beneficiaries.
        const beneficiary = isOwn
          ? null
          : await BeneficiaryModel.findOne({
              userId,
              accountNumber: input.toAccountNumber,
            }).session(session);
        if (!isOwn && !beneficiary) {
          throw new HttpError(
            422,
            'BENEFICIARY_REQUIRED',
            'Add this account as a beneficiary before sending money to it',
          );
        }
        if (!to) {
          throw new HttpError(
            422,
            'ACCOUNT_NOT_FOUND',
            'No NeoBank account has this number',
          );
        }
        if (to.status !== 'ACTIVE') throw recipientUnavailable();

        const amount = input.amountPaise;
        const debited = await debitOwnAccount(session, {
          accountId: from.id,
          userId,
          amount,
        });
        if (!isOwn) await consumeDailyLimit(session, userId, amount);

        const credited = await AccountModel.findOneAndUpdate(
          { _id: to._id, status: 'ACTIVE' },
          { $inc: { balance: amount } },
          { returnDocument: 'after', session },
        );
        if (!credited) throw recipientUnavailable();

        const [transaction] = await TransactionModel.create(
          [
            {
              type: 'TRANSFER',
              fromAccountId: from._id,
              toAccountId: to._id,
              amount,
              description: input.description,
              initiatedBy: userId,
              isExternal: !isOwn,
            },
          ],
          { session },
        );

        // What each side sees on their statement as "the other party".
        const sender = isOwn
          ? null
          : await UserModel.findById(userId).session(session);
        const toLabel = `${beneficiary?.name ?? TYPE_LABEL[to.type]} · ${maskAccountNumber(to.accountNumber)}`;
        const fromLabel = `${sender?.name ?? TYPE_LABEL[from.type]} · ${maskAccountNumber(from.accountNumber)}`;

        const [debitEntry] = await LedgerEntryModel.create(
          [
            {
              transactionId: transaction._id,
              accountId: from._id,
              type: 'TRANSFER',
              direction: 'DEBIT',
              amount,
              balanceAfter: debited.balance,
              description: input.description,
              counterparty: toLabel,
            },
            {
              transactionId: transaction._id,
              accountId: to._id,
              type: 'TRANSFER',
              direction: 'CREDIT',
              amount,
              balanceAfter: credited.balance,
              description: input.description,
              counterparty: fromLabel,
            },
          ],
          { session, ordered: true },
        );

        return {
          transactionId: transaction.id,
          fromAccount: toAccountDto(debited),
          entry: toLedgerEntryDto(debitEntry),
        };
      },
    );
  }
}
