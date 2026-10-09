import { z } from 'zod';
import request from 'supertest';
import {
  AdminStatsSchema,
  AdminTransactionsPageSchema,
  AdminUserDetailSchema,
  AdminUsersPageSchema,
  AuditEntryDtoSchema,
} from '@neobank/shared/models';
import { createApp } from '../../app';
import { signUp, signUpAdmin } from '../../test/test-auth';
import { testConfig } from '../../test/test-config';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/test-db';
import { openAccount } from '../../test/test-money';
import { DEMO_USERS } from '../../seed/demo-data';
import { UserModel } from '../users/user.model';

type Auth = { Authorization: string };

describe('admin API', () => {
  const app = createApp(testConfig());
  let admin: Auth;
  let customer: { auth: Auth; userId: string };
  let account: { id: string; accountNumber: string };

  beforeAll(startTestDb, 60_000);
  afterAll(stopTestDb);
  beforeEach(async () => {
    await clearTestDb();
    ({ auth: admin } = await signUpAdmin(app));
    customer = await signUp(app, 'Meera Iyer');
    account = await openAccount(app, customer.auth, 2_000_00);
  });

  it('is only for admins', async () => {
    expect((await request(app).get('/api/admin/stats')).status).toBe(401);
    expect(
      (await request(app).get('/api/admin/stats').set(customer.auth)).status,
    ).toBe(403);
  });

  it('reports bank-wide stats', async () => {
    const res = await request(app).get('/api/admin/stats').set(admin);

    expect(AdminStatsSchema.parse(res.body)).toEqual({
      users: 2,
      accounts: 1,
      frozenAccounts: 0,
      totalBalance: 2_000_00,
      transactionsToday: 1,
      volumeTodayPaise: 2_000_00,
    });
  });

  it('lists and searches users with their totals', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .query({ q: 'meera' })
      .set(admin);

    const page = AdminUsersPageSchema.parse(res.body);
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({
      name: 'Meera Iyer',
      accountCount: 1,
      totalBalance: 2_000_00,
    });

    const detail = await request(app)
      .get(`/api/admin/users/${customer.userId}`)
      .set(admin);
    expect(AdminUserDetailSchema.parse(detail.body).accounts).toHaveLength(1);
  });

  describe('freezing accounts', () => {
    const setStatus = (
      status: string,
      reason = 'Suspicious activity reported',
    ) =>
      request(app)
        .patch(`/api/admin/accounts/${account.id}/status`)
        .set(admin)
        .send({ status, reason });

    it('freezes an account, blocks money movement and writes an audit entry', async () => {
      const res = await setStatus('FROZEN');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('FROZEN');

      const deposit = await request(app)
        .post(`/api/accounts/${account.id}/deposit`)
        .set(customer.auth)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ amountPaise: 100 });
      expect(deposit.status).toBe(409);

      const audit = await request(app).get('/api/admin/audit').set(admin);
      const [entry] = z.array(AuditEntryDtoSchema).parse(audit.body);
      expect(entry).toMatchObject({
        adminName: 'Admin User',
        action: 'ACCOUNT_FROZEN',
        target: expect.stringContaining('Meera Iyer'),
        reason: 'Suspicious activity reported',
      });

      expect(
        (await setStatus('ACTIVE', 'Verified with customer')).body.status,
      ).toBe('ACTIVE');
    });

    it('requires a reason and rejects no-op changes', async () => {
      expect((await setStatus('FROZEN', '')).status).toBe(400);
      const noop = await setStatus('ACTIVE');
      expect(noop.status).toBe(409);
      expect(noop.body.error.code).toBe('NO_CHANGE');
    });
  });

  it('lists all transactions with account numbers and who made them', async () => {
    const res = await request(app).get('/api/admin/transactions').set(admin);

    const page = AdminTransactionsPageSchema.parse(res.body);
    expect(page.items[0]).toMatchObject({
      type: 'DEPOSIT',
      amount: 2_000_00,
      fromAccountNumber: null,
      toAccountNumber: account.accountNumber,
      initiatedBy: 'Meera Iyer',
    });
  });

  it('resets the demo data and records it', async () => {
    const res = await request(app).post('/api/admin/demo/reset').set(admin);

    expect(res.status).toBe(204);
    expect(
      await UserModel.exists({ email: DEMO_USERS.demo.email }),
    ).toBeTruthy();
    const audit = (await request(app).get('/api/admin/audit').set(admin)).body;
    expect(audit[0].action).toBe('DEMO_RESET');
  });
});
