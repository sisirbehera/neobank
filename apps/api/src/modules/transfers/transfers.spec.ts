import request from 'supertest';
import { TransferResponseSchema } from '@neobank/shared/models';
import { createApp } from '../../app';
import { signUp } from '../../test/test-auth';
import { testConfig } from '../../test/test-config';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/test-db';
import { openAccount } from '../../test/test-money';
import { AccountModel } from '../accounts/account.model';
import { LedgerEntryModel } from '../transactions/ledger-entry.model';
import { TransactionModel } from '../transactions/transaction.model';

type Auth = { Authorization: string };

describe('transfers API', () => {
  const app = createApp(testConfig());

  let asha: Auth;
  let ravi: Auth;
  let savings: { id: string; accountNumber: string };
  let current: { id: string; accountNumber: string };
  let raviAccount: { id: string; accountNumber: string };

  beforeAll(startTestDb, 60_000);
  afterAll(stopTestDb);
  beforeEach(async () => {
    await clearTestDb();
    ({ auth: asha } = await signUp(app, 'Asha Rao'));
    ({ auth: ravi } = await signUp(app, 'Ravi Kumar'));
    savings = await openAccount(app, asha, 1_00_000_00); // ₹1,00,000
    current = await openAccount(app, asha, 0, 'CURRENT');
    raviAccount = await openAccount(app, ravi);
  });

  const balance = async (id: string) =>
    (await AccountModel.findById(id))?.balance;

  const transfer = (
    body: Record<string, unknown>,
    {
      auth = asha,
      key = crypto.randomUUID(),
    }: { auth?: Auth; key?: string } = {},
  ) =>
    request(app)
      .post('/api/transfers')
      .set(auth)
      .set('Idempotency-Key', key)
      .send({ fromAccountId: savings.id, ...body });

  const addRaviAsBeneficiary = () =>
    request(app)
      .post('/api/beneficiaries')
      .set(asha)
      .send({ name: 'Ravi', accountNumber: raviAccount.accountNumber })
      .expect(201);

  describe('between own accounts', () => {
    it('debits one account, credits the other and records both sides', async () => {
      const res = await transfer({
        toAccountNumber: current.accountNumber,
        amountPaise: 25000,
        description: 'Move to current',
      });

      expect(res.status).toBe(201);
      const body = TransferResponseSchema.parse(res.body);
      expect(body.fromAccount.balance).toBe(1_00_000_00 - 25000);
      expect(body.entry).toMatchObject({
        type: 'TRANSFER',
        direction: 'DEBIT',
        amount: 25000,
        counterparty: expect.stringContaining('Current ·'),
      });
      expect(await balance(current.id)).toBe(25000);

      const entries = await LedgerEntryModel.find({
        transactionId: body.transactionId,
      });
      expect(entries.map((e) => e.direction).sort()).toEqual([
        'CREDIT',
        'DEBIT',
      ]);
    });

    it('rejects paying into the same account', async () => {
      const res = await transfer({
        toAccountNumber: savings.accountNumber,
        amountPaise: 100,
      });
      expect(res.status).toBe(400);
    });
  });

  describe('to other people', () => {
    it('requires the recipient to be a saved beneficiary', async () => {
      const res = await transfer({
        toAccountNumber: raviAccount.accountNumber,
        amountPaise: 100,
      });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('BENEFICIARY_REQUIRED');
      expect(await balance(savings.id)).toBe(1_00_000_00);
    });

    it('moves money to a beneficiary; the recipient sees who sent it', async () => {
      await addRaviAsBeneficiary();

      const res = await transfer({
        toAccountNumber: raviAccount.accountNumber,
        amountPaise: 50000,
        description: 'Dinner',
      });

      expect(res.status).toBe(201);
      expect(res.body.entry.counterparty).toMatch(/^Ravi · ••••/);
      expect(await balance(raviAccount.id)).toBe(50000);

      const activity = await request(app)
        .get(`/api/accounts/${raviAccount.id}/activity`)
        .set(ravi);
      expect(activity.body[0]).toMatchObject({
        direction: 'CREDIT',
        description: 'Dinner',
        counterparty: expect.stringMatching(/^Asha Rao · ••••/),
      });
    });

    it('rolls back the debit if the recipient account is frozen', async () => {
      await addRaviAsBeneficiary();
      await AccountModel.updateOne(
        { _id: raviAccount.id },
        { status: 'FROZEN' },
      );

      const res = await transfer({
        toAccountNumber: raviAccount.accountNumber,
        amountPaise: 1000,
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('RECIPIENT_NOT_ACTIVE');
      expect(await balance(savings.id)).toBe(1_00_000_00);
      expect(await TransactionModel.countDocuments({ type: 'TRANSFER' })).toBe(
        0,
      );
    });

    it('enforces the ₹2,00,000 daily limit for transfers to others', async () => {
      await addRaviAsBeneficiary();
      const big = await openAccount(app, asha, 3_00_000_00);

      for (let i = 0; i < 2; i++) {
        await transfer({
          fromAccountId: big.id,
          toAccountNumber: raviAccount.accountNumber,
          amountPaise: 1_00_000_00,
        }).expect(201);
      }
      const over = await transfer({
        fromAccountId: big.id,
        toAccountNumber: raviAccount.accountNumber,
        amountPaise: 100,
      });
      expect(over.status).toBe(422);
      expect(over.body.error.code).toBe('DAILY_LIMIT_EXCEEDED');

      // Moving money between your own accounts doesn't count.
      await transfer({
        fromAccountId: big.id,
        toAccountNumber: current.accountNumber,
        amountPaise: 1_00_000_00,
      }).expect(201);
    });
  });

  it('rejects insufficient funds without changing anything', async () => {
    const res = await transfer({
      fromAccountId: current.id, // ₹0
      toAccountNumber: savings.accountNumber,
      amountPaise: 1,
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INSUFFICIENT_FUNDS');
    expect(await balance(savings.id)).toBe(1_00_000_00);
  });

  it('cannot pay from someone else’s account', async () => {
    const res = await transfer(
      {
        fromAccountId: raviAccount.id,
        toAccountNumber: savings.accountNumber,
        amountPaise: 1,
      },
      { auth: asha },
    );
    expect(res.status).toBe(404);
  });

  describe('idempotency', () => {
    const body = () => ({
      toAccountNumber: current.accountNumber,
      amountPaise: 1000,
    });

    it('replays the original result for a retried request', async () => {
      const key = crypto.randomUUID();

      const first = await transfer(body(), { key });
      const retry = await transfer(body(), { key });

      expect(retry.status).toBe(201);
      expect(retry.headers['idempotent-replayed']).toBe('true');
      expect(retry.body).toEqual(first.body);
      expect(await balance(current.id)).toBe(1000);
      expect(await TransactionModel.countDocuments({ type: 'TRANSFER' })).toBe(
        1,
      );
    });

    it('moves money once when identical requests arrive at the same time', async () => {
      const key = crypto.randomUUID();

      const results = await Promise.all(
        Array.from({ length: 5 }, () => transfer(body(), { key })),
      );

      expect(results.every((r) => r.status === 201)).toBe(true);
      expect(new Set(results.map((r) => r.body.transactionId)).size).toBe(1);
      expect(await balance(current.id)).toBe(1000);
    });

    it('refuses to reuse a key for a different request', async () => {
      const key = crypto.randomUUID();
      await transfer(body(), { key }).expect(201);

      const res = await transfer({ ...body(), amountPaise: 2000 }, { key });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('requires the header', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set(asha)
        .send({ fromAccountId: savings.id, ...body() });
      expect(res.status).toBe(400);
    });
  });

  it('never creates or destroys money', async () => {
    await addRaviAsBeneficiary();
    const total = async () =>
      (await AccountModel.find()).reduce((sum, a) => sum + a.balance, 0);
    const before = await total();

    await Promise.all([
      transfer({ toAccountNumber: current.accountNumber, amountPaise: 30000 }),
      transfer({
        toAccountNumber: raviAccount.accountNumber,
        amountPaise: 20000,
      }),
      transfer({
        toAccountNumber: raviAccount.accountNumber,
        amountPaise: 99_99_999,
      }),
      transfer(
        {
          fromAccountId: raviAccount.id,
          toAccountNumber: savings.accountNumber,
          amountPaise: 5,
        },
        { auth: ravi },
      ),
    ]);

    expect(await total()).toBe(before);
  });
});
