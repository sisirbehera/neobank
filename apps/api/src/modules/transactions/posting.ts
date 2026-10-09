import type { ClientSession } from 'mongoose';
import { HttpError } from '../../lib/http-error';
import { AccountModel, type AccountDocument } from '../accounts/account.model';

/**
 * Building blocks for moving money. They must be called inside a MongoDB
 * transaction (pass its session) so that partial updates are rolled back.
 */

export const accountNotFound = () => HttpError.notFound('Account not found');

interface Posting {
  accountId: string;
  userId: string;
  amount: number;
}

/**
 * Takes `amount` paise from one of the user's accounts. The filter itself is
 * the safety check: it only matches an ACTIVE account with enough balance, so
 * concurrent debits can never overdraw.
 */
export async function debitOwnAccount(
  session: ClientSession,
  { accountId, userId, amount }: Posting,
): Promise<AccountDocument> {
  const account = await AccountModel.findOneAndUpdate(
    { _id: accountId, userId, status: 'ACTIVE', balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { returnDocument: 'after', session },
  );
  if (account) return account;
  throw await explainFailure(session, accountId, userId);
}

/** Adds `amount` paise to one of the user's ACTIVE accounts (demo deposits). */
export async function creditOwnAccount(
  session: ClientSession,
  { accountId, userId, amount }: Posting,
): Promise<AccountDocument> {
  const account = await AccountModel.findOneAndUpdate(
    { _id: accountId, userId, status: 'ACTIVE' },
    { $inc: { balance: amount } },
    { returnDocument: 'after', session },
  );
  if (account) return account;
  throw await explainFailure(session, accountId, userId);
}

/** Works out which condition of a failed debit/credit wasn't met. */
async function explainFailure(
  session: ClientSession,
  accountId: string,
  userId: string,
): Promise<HttpError> {
  const account = await AccountModel.findOne({
    _id: accountId,
    userId,
  }).session(session);

  if (!account) return accountNotFound();
  if (account.status !== 'ACTIVE') {
    return HttpError.conflict(
      `This account is ${account.status.toLowerCase()}`,
      'ACCOUNT_NOT_ACTIVE',
    );
  }
  return new HttpError(422, 'INSUFFICIENT_FUNDS', 'Insufficient funds');
}
