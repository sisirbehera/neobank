import request from 'supertest';
import {
  AccountDtoSchema,
  LedgerEntryDtoSchema,
  MoneyMovementResponseSchema,
} from '@neobank/shared/models';
import { isValidAccountNumber } from '@neobank/shared/utils';
import { createApp } from '../../app';
import { signUp } from '../../test/test-auth';
import { testConfig } from '../../test/test-config';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/test-db';
import { LedgerEntryModel } from '../transactions/ledger-entry.model';
import { TransactionModel } from '../transactions/transaction.model';
import { AccountModel } from './account.model';

describe('accounts API', () => {
  const app = createApp(testConfig());
  let auth: { Authorization: string };

  beforeAll(startTestDb, 60_000);
  afterAll(stopTestDb);
  beforeEach(async () => {
    await clearTestDb();
    ({ auth } = await signUp(app));
  });

  const open = (body: object = { type: 'SAVINGS' }, headers = auth) =>
    request(app).post('/api/accounts').set(headers).send(body);

  const deposit = (
    id: string,
    amountPaise: number,
    headers = auth,
    key = crypto.randomUUID(),
  ) =>
    request(app)
      .post(`/api/accounts/${id}/deposit`)
      .set(headers)
      .set('Idempotency-Key', key)
      .send({ amountPaise, description: 'Cash' });

  const withdraw = (id: string, amountPaise: number, headers = auth) =>
    request(app)
      .post(`/api/accounts/${id}/withdraw`)
      .set(headers)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({ amountPaise });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/accounts')).status).toBe(401);
  });

  describe('opening accounts', () => {
    it('opens an account with a valid account number and zero balance', async () => {
      const res = await open({ type: 'CURRENT', nickname: ' Business ' });

      expect(res.status).toBe(201);
      const account = AccountDtoSchema.parse(res.body);
      expect(account).toMatchObject({
        type: 'CURRENT',
        nickname: 'Business',
        balance: 0,
        status: 'ACTIVE',
        currency: 'INR',
      });
      expect(isValidAccountNumber(account.accountNumber)).toBe(true);
    });

    it('limits a user to 5 accounts', async () => {
      for (let i = 0; i < 5; i++) await open().expect(201);

      const res = await open();
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ACCOUNT_LIMIT');
    });

    it('lists only the signed-in user’s accounts', async () => {
      await open();
      const other = await signUp(app, 'Other User');
      await open({ type: 'CURRENT' }, other.auth);

      const res = await request(app).get('/api/accounts').set(auth);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].type).toBe('SAVINGS');
    });

    it('hides other users’ accounts behind a 404', async () => {
      const other = await signUp(app, 'Other User');
      const { id } = (await open({ type: 'SAVINGS' }, other.auth)).body;

      expect(
        (await request(app).get(`/api/accounts/${id}`).set(auth)).status,
      ).toBe(404);
      expect((await deposit(id, 100)).status).toBe(404);
      expect(
        (await request(app).get('/api/accounts/not-an-id').set(auth)).status,
      ).toBe(404);
    });
  });

  describe('deposits and withdrawals', () => {
    let id: string;

    beforeEach(async () => {
      id = (await open()).body.id;
    });

    it('deposits money and records a credit entry', async () => {
      const res = await deposit(id, 150000);

      expect(res.status).toBe(200);
      const { account, entry } = MoneyMovementResponseSchema.parse(res.body);
      expect(account.balance).toBe(150000);
      expect(entry).toMatchObject({
        type: 'DEPOSIT',
        direction: 'CREDIT',
        amount: 150000,
        balanceAfter: 150000,
        description: 'Cash',
      });
    });

    it('withdraws money and records a debit entry', async () => {
      await deposit(id, 100000);

      const res = await withdraw(id, 25050);

      expect(res.status).toBe(200);
      expect(res.body.account.balance).toBe(74950);
      expect(res.body.entry).toMatchObject({
        direction: 'DEBIT',
        balanceAfter: 74950,
      });
    });

    it('rejects a withdrawal larger than the balance and changes nothing', async () => {
      await deposit(id, 1000);

      const res = await withdraw(id, 1001);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INSUFFICIENT_FUNDS');
      expect((await AccountModel.findById(id))?.balance).toBe(1000);
      expect(
        await TransactionModel.countDocuments({ type: 'WITHDRAWAL' }),
      ).toBe(0);
    });

    it('rejects money movement on a frozen account', async () => {
      await AccountModel.updateOne({ _id: id }, { status: 'FROZEN' });

      const res = await deposit(id, 1000);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ACCOUNT_NOT_ACTIVE');
    });

    it.each([
      [0, 'zero'],
      [10.5, 'fractional paise'],
      [1_00_000_01, 'over ₹1,00,000'],
    ])('rejects an amount of %s (%s)', async (amountPaise) => {
      expect((await deposit(id, amountPaise)).status).toBe(400);
    });

    it('requires an Idempotency-Key', async () => {
      const res = await request(app)
        .post(`/api/accounts/${id}/deposit`)
        .set(auth)
        .send({ amountPaise: 100 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Idempotency-Key');
    });

    it('deposits only once when the same request is retried', async () => {
      const key = crypto.randomUUID();

      const first = await deposit(id, 5000, auth, key);
      const retry = await deposit(id, 5000, auth, key);

      expect(retry.status).toBe(200);
      expect(retry.headers['idempotent-replayed']).toBe('true');
      expect(retry.body).toEqual(first.body);
      expect((await AccountModel.findById(id))?.balance).toBe(5000);
    });

    it('never overdraws under concurrent withdrawals', async () => {
      await deposit(id, 10000); // ₹100

      // Five ₹30 withdrawals at the same time: only three can succeed.
      const results = await Promise.all(
        Array.from({ length: 5 }, () => withdraw(id, 3000)),
      );

      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([200, 200, 200, 422, 422]);
      expect((await AccountModel.findById(id))?.balance).toBe(1000);
    });

    it('keeps the balance equal to the sum of its ledger entries', async () => {
      await deposit(id, 50000);
      await withdraw(id, 12345);
      await deposit(id, 999);
      await withdraw(id, 1);

      const entries = await LedgerEntryModel.find({ accountId: id });
      const fromLedger = entries.reduce(
        (sum, e) => sum + (e.direction === 'CREDIT' ? e.amount : -e.amount),
        0,
      );
      expect(fromLedger).toBe((await AccountModel.findById(id))?.balance);
      expect(fromLedger).toBe(50000 - 12345 + 999 - 1);
    });
  });

  describe('activity', () => {
    it('returns newest entries first, per account and across accounts', async () => {
      const a = (await open()).body.id;
      const b = (await open({ type: 'CURRENT' })).body.id;
      await deposit(a, 100);
      await deposit(b, 200);
      await withdraw(a, 50);

      const one = await request(app)
        .get(`/api/accounts/${a}/activity`)
        .set(auth);
      expect(one.body.map((e: { amount: number }) => e.amount)).toEqual([
        50, 100,
      ]);

      const all = await request(app)
        .get('/api/accounts/activity?limit=2')
        .set(auth);
      expect(all.body).toHaveLength(2);
      expect(LedgerEntryDtoSchema.parse(all.body[0]).amount).toBe(50);
    });

    it('validates the limit', async () => {
      const res = await request(app)
        .get('/api/accounts/activity?limit=500')
        .set(auth);
      expect(res.status).toBe(400);
    });
  });
});
