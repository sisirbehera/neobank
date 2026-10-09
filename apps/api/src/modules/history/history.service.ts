import { isValidObjectId, type QueryFilter, Types } from 'mongoose';
import type {
  HistoryPage,
  HistoryQuerySchema,
  MonthlySummary,
} from '@neobank/shared/models';
import { formatAccountNumber } from '@neobank/shared/utils';
import type { z } from 'zod';
import { type CsvCell, paiseToDecimal, toCsv } from '../../lib/csv';
import {
  endOfIstDay,
  istDateTimeText,
  lastIstMonths,
  startOfIstDay,
} from '../../lib/ist';
import { escapeRegex } from '../../lib/regex';
import { AccountModel } from '../accounts/account.model';
import {
  type LedgerEntry,
  LedgerEntryModel,
  toLedgerEntryDto,
} from '../transactions/ledger-entry.model';
import { accountNotFound } from '../transactions/posting';

type HistoryQuery = z.output<typeof HistoryQuerySchema>;

/** CSV exports are capped so one request can't load the whole database. */
export const MAX_EXPORT_ROWS = 5000;

export class HistoryService {
  async list(userId: string, query: HistoryQuery): Promise<HistoryPage> {
    const filter = await this.filter(userId, query);
    const [entries, total] = await Promise.all([
      LedgerEntryModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize),
      LedgerEntryModel.countDocuments(filter),
    ]);
    return {
      items: entries.map(toLedgerEntryDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  /** Statement as CSV (same filters as list, no paging, newest first). */
  async exportCsv(userId: string, query: HistoryQuery): Promise<string> {
    const filter = await this.filter(userId, query);
    const [entries, accounts] = await Promise.all([
      LedgerEntryModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(MAX_EXPORT_ROWS),
      AccountModel.find({ userId }),
    ]);
    const numbers = new Map(accounts.map((a) => [a.id, a.accountNumber]));

    const rows: CsvCell[][] = [
      [
        'Date (IST)',
        'Account',
        'Type',
        'Direction',
        'Description',
        'Counterparty',
        'Amount (INR)',
        'Balance after (INR)',
      ],
      ...entries.map((e) => [
        istDateTimeText(e.createdAt),
        formatAccountNumber(numbers.get(e.accountId.toString()) ?? ''),
        e.type,
        e.direction,
        e.description,
        e.counterparty,
        paiseToDecimal(e.direction === 'CREDIT' ? e.amount : -e.amount),
        paiseToDecimal(e.balanceAfter),
      ]),
    ];
    return toCsv(rows);
  }

  /** Money in/out per IST month for the last `months` months. */
  async monthlySummary(userId: string, months = 6): Promise<MonthlySummary> {
    const keys = lastIstMonths(months);
    const accountIds = await AccountModel.find({ userId }).distinct('_id');

    const rows = await LedgerEntryModel.aggregate<{
      _id: string;
      inPaise: number;
      outPaise: number;
    }>([
      {
        $match: {
          accountId: { $in: accountIds },
          // Moving money between your own accounts isn't income or spending.
          internal: { $ne: true },
          createdAt: { $gte: startOfIstDay(`${keys[0]}-01`) },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m',
              date: '$createdAt',
              timezone: 'Asia/Kolkata',
            },
          },
          inPaise: {
            $sum: { $cond: [{ $eq: ['$direction', 'CREDIT'] }, '$amount', 0] },
          },
          outPaise: {
            $sum: { $cond: [{ $eq: ['$direction', 'DEBIT'] }, '$amount', 0] },
          },
        },
      },
    ]);

    // Months without activity still appear, with zeros.
    const byMonth = new Map(rows.map((r) => [r._id, r]));
    return keys.map((month) => ({
      month,
      inPaise: byMonth.get(month)?.inPaise ?? 0,
      outPaise: byMonth.get(month)?.outPaise ?? 0,
    }));
  }

  private async filter(
    userId: string,
    query: HistoryQuery,
  ): Promise<QueryFilter<LedgerEntry>> {
    let accountIds: Types.ObjectId[];
    if (query.accountId) {
      if (!isValidObjectId(query.accountId)) throw accountNotFound();
      const account = await AccountModel.findOne({
        _id: query.accountId,
        userId,
      });
      if (!account) throw accountNotFound();
      accountIds = [account._id];
    } else {
      accountIds = await AccountModel.find({ userId }).distinct('_id');
    }

    const filter: QueryFilter<LedgerEntry> = { accountId: { $in: accountIds } };
    if (query.type) filter.type = query.type;
    if (query.direction) filter.direction = query.direction;
    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from ? { $gte: startOfIstDay(query.from) } : {}),
        ...(query.to ? { $lte: endOfIstDay(query.to) } : {}),
      };
    }
    if (query.q) {
      const pattern = new RegExp(escapeRegex(query.q), 'i');
      filter.$or = [{ description: pattern }, { counterparty: pattern }];
    }
    return filter;
  }
}
