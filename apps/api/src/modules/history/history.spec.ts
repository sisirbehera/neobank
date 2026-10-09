import request from 'supertest';
import {
  HistoryPageSchema,
  MonthlySummarySchema,
} from '@neobank/shared/models';
import { createApp } from '../../app';
import { istDay } from '../../lib/ist';
import { signUp } from '../../test/test-auth';
import { testConfig } from '../../test/test-config';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/test-db';
import { openAccount } from '../../test/test-money';
import { LedgerEntryModel } from '../transactions/ledger-entry.model';

type Auth = { Authorization: string };

describe('history API', () => {
  const app = createApp(testConfig());
  let auth: Auth;
  let savings: { id: string; accountNumber: string };
  let current: { id: string; accountNumber: string };

  beforeAll(startTestDb, 60_000);
  afterAll(stopTestDb);
  beforeEach(async () => {
    await clearTestDb();
    ({ auth } = await signUp(app, 'Asha Rao'));
    savings = await openAccount(app, auth, 50_000_00); // 1 deposit
    current = await openAccount(app, auth, 0, 'CURRENT');
  });

  const move = (path: string, body: object) =>
    request(app)
      .post(path)
      .set(auth)
      .set('Idempotency-Key', crypto.randomUUID())
      .send(body)
      .expect((res) => expect(res.status).toBeLessThan(300));

  const history = (query: Record<string, string | number> = {}) =>
    request(app).get('/api/transactions').query(query).set(auth);

  describe('list', () => {
    beforeEach(async () => {
      await move(`/api/accounts/${savings.id}/withdraw`, {
        amountPaise: 500_00,
        description: 'ATM',
      });
      await move('/api/transfers', {
        fromAccountId: savings.id,
        toAccountNumber: current.accountNumber,
        amountPaise: 10_000_00,
        description: 'Budget',
      });
      await move(`/api/accounts/${current.id}/withdraw`, {
        amountPaise: 250_00,
        description: '=cmd|calc',
      });
    });

    it('returns newest first with a total for paging', async () => {
      const res = await history({ pageSize: 2 });

      expect(res.status).toBe(200);
      const page = HistoryPageSchema.parse(res.body);
      // 1 deposit + 1 withdrawal + 2 transfer sides + 1 withdrawal
      expect(page.total).toBe(5);
      expect(page.items).toHaveLength(2);
      expect(page.items[0].description).toBe('=cmd|calc');

      const last = HistoryPageSchema.parse(
        (await history({ pageSize: 2, page: 3 })).body,
      );
      expect(last.items).toHaveLength(1);
      expect(last.items[0].type).toBe('DEPOSIT');
    });

    it('filters by account, type, direction and text', async () => {
      const byAccount = (await history({ accountId: current.id })).body;
      expect(byAccount.total).toBe(2);

      const debits = (await history({ direction: 'DEBIT', type: 'WITHDRAWAL' }))
        .body;
      expect(debits.total).toBe(2);

      const search = (await history({ q: 'budg' })).body;
      expect(search.total).toBe(2); // both sides of the transfer
    });

    it('treats search text literally (no regex injection)', async () => {
      expect((await history({ q: '.*' })).body.total).toBe(0);
    });

    it('filters by IST date range', async () => {
      const today = istDay();
      expect((await history({ from: today, to: today })).body.total).toBe(5);
      expect((await history({ to: '2020-01-01' })).body.total).toBe(0);
    });

    it('rejects someone else’s account and bad queries', async () => {
      const other = await signUp(app, 'Other');
      const theirs = await openAccount(app, other.auth);

      expect((await history({ accountId: theirs.id })).status).toBe(404);
      expect((await history({ from: 'yesterday' })).status).toBe(400);
      expect((await history({ type: 'GIFT' })).status).toBe(400);
    });
  });

  describe('CSV export', () => {
    it('downloads a statement with safe text cells', async () => {
      await move(`/api/accounts/${savings.id}/withdraw`, {
        amountPaise: 1250_75,
        description: '=HYPERLINK("http://evil")',
      });

      const res = await request(app)
        .get('/api/transactions/export.csv')
        .query({ accountId: savings.id })
        .set(auth);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toMatch(
        /attachment; filename="neobank-statement-\d{4}-\d{2}-\d{2}\.csv"/,
      );
      const lines = res.text.replace('﻿', '').trim().split('\r\n');
      expect(lines[0]).toBe(
        'Date (IST),Account,Type,Direction,Description,Counterparty,Amount (INR),Balance after (INR)',
      );
      expect(lines).toHaveLength(3); // header + withdrawal + deposit
      expect(lines[1]).toContain(`"'=HYPERLINK(""http://evil"")"`);
      expect(lines[1]).toMatch(/,-1250\.75,48749\.25$/);
      expect(lines[2]).toMatch(/,DEPOSIT,CREDIT,,,50000\.00,50000\.00$/);
    });

    it('requires authentication', async () => {
      expect(
        (await request(app).get('/api/transactions/export.csv')).status,
      ).toBe(401);
    });
  });

  describe('monthly summary', () => {
    it('reports money in and out, excluding transfers between own accounts', async () => {
      await move('/api/transfers', {
        fromAccountId: savings.id,
        toAccountNumber: current.accountNumber,
        amountPaise: 5_000_00,
      });
      await move(`/api/accounts/${current.id}/withdraw`, {
        amountPaise: 1_000_00,
      });

      const res = await request(app).get('/api/transactions/summary').set(auth);

      expect(res.status).toBe(200);
      const months = MonthlySummarySchema.parse(res.body);
      expect(months).toHaveLength(6);
      expect(months[5]).toEqual({
        month: istDay().slice(0, 7),
        inPaise: 50_000_00,
        outPaise: 1_000_00,
      });
      expect(
        months.slice(0, 5).every((m) => m.inPaise === 0 && m.outPaise === 0),
      ).toBe(true);
      // The own-account transfer is in the ledger, just marked internal.
      expect(await LedgerEntryModel.countDocuments({ internal: true })).toBe(2);
    });
  });
});
