import request from 'supertest';
import { createApp } from '../app';
import { AccountModel } from '../modules/accounts/account.model';
import { LedgerEntryModel } from '../modules/transactions/ledger-entry.model';
import { UserModel } from '../modules/users/user.model';
import { testConfig } from '../test/test-config';
import { clearTestDb, startTestDb, stopTestDb } from '../test/test-db';
import { DEMO_USERS, ensureAdmin, seedDemoData } from './demo-data';

describe('demo data', () => {
  const app = createApp(testConfig());

  beforeAll(startTestDb, 60_000);
  afterAll(stopTestDb);
  beforeEach(clearTestDb);

  it('creates users with history whose balances match their ledgers', async () => {
    await seedDemoData();

    const accounts = await AccountModel.find();
    expect(accounts).toHaveLength(3);
    for (const account of accounts) {
      const entries = await LedgerEntryModel.find({
        accountId: account._id,
      }).sort({
        createdAt: 1,
      });
      const sum = entries.reduce(
        (s, e) => s + (e.direction === 'CREDIT' ? e.amount : -e.amount),
        0,
      );
      expect(sum).toBe(account.balance);
      expect(entries.at(-1)?.balanceAfter ?? 0).toBe(account.balance);
    }
  });

  it('lets the demo user log in and see six months of activity', async () => {
    await seedDemoData();

    const login = await request(app)
      .post('/api/auth/login')
      .send({
        email: DEMO_USERS.demo.email,
        password: DEMO_USERS.demo.password,
      })
      .expect(200);
    const auth = { Authorization: `Bearer ${login.body.accessToken}` };

    const summary = (
      await request(app).get('/api/transactions/summary').set(auth)
    ).body;
    const activeMonths = summary.filter(
      (m: { inPaise: number }) => m.inPaise > 0,
    );
    expect(activeMonths.length).toBeGreaterThanOrEqual(5);
  });

  it('is idempotent, and reset rebuilds it from scratch', async () => {
    await seedDemoData();
    await seedDemoData();
    expect(await UserModel.countDocuments()).toBe(2);

    const before = await AccountModel.find().distinct('accountNumber');
    await seedDemoData({ reset: true });
    const after = await AccountModel.find().distinct('accountNumber');

    expect(await UserModel.countDocuments()).toBe(2);
    expect(after).toHaveLength(3);
    expect(after).not.toEqual(before);
  });

  it('creates or promotes the admin', async () => {
    await ensureAdmin('Admin@Example.com', 'Admin@1234');
    await ensureAdmin('admin@example.com', 'ignored-on-second-run');

    const admins = await UserModel.find({ role: 'admin' });
    expect(admins.map((a) => a.email)).toEqual(['admin@example.com']);
  });
});
