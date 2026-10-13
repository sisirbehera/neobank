import request from 'supertest';
import {
  NotificationsPageSchema,
  NotificationSummarySchema,
} from '@neobank/shared/models';
import { createApp } from '../../app';
import { signUp, signUpAdmin } from '../../test/test-auth';
import { testConfig } from '../../test/test-config';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/test-db';
import { openAccount } from '../../test/test-money';
import { UserModel } from '../users/user.model';
import { NotificationModel } from './notifications';

type Auth = { Authorization: string };

describe('notifications', () => {
  const app = createApp(testConfig());
  let asha: Auth;
  let ravi: Auth;
  let raviId: string;
  let raviEmail: string;

  beforeAll(startTestDb, 60_000);
  afterAll(stopTestDb);
  beforeEach(async () => {
    await clearTestDb();
    ({ auth: asha } = await signUp(app, 'Asha Rao'));
    ({
      auth: ravi,
      userId: raviId,
      email: raviEmail,
    } = await signUp(app, 'Ravi Kumar'));
  });

  const list = async (auth: Auth) =>
    NotificationsPageSchema.parse(
      (await request(app).get('/api/notifications').set(auth).expect(200)).body,
    );

  const summary = async (auth: Auth) =>
    NotificationSummarySchema.parse(
      (
        await request(app)
          .get('/api/notifications/summary')
          .set(auth)
          .expect(200)
      ).body,
    );

  async function payRavi(amountPaise: number) {
    const from = await openAccount(app, asha, 1_00_000_00);
    const to = await openAccount(app, ravi);
    await request(app)
      .post('/api/beneficiaries')
      .set(asha)
      .send({ name: 'Ravi', accountNumber: to.accountNumber })
      .expect(201);
    await request(app)
      .post('/api/transfers')
      .set(asha)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        fromAccountId: from.id,
        toAccountNumber: to.accountNumber,
        amountPaise,
      })
      .expect(201);
    return { from, to };
  }

  const signIn = (email: string, userAgent: string) =>
    request(app)
      .post('/api/auth/login')
      .set('User-Agent', userAgent)
      .send({ email, password: 'secret123' })
      .expect(200);

  it('tells the receiver about money from someone else, as type and values', async () => {
    const { to } = await payRavi(2_500_00);

    const { items, unreadCount } = await list(ravi);

    expect(unreadCount).toBe(1);
    expect(items[0]).toMatchObject({
      type: 'MONEY_RECEIVED',
      read: false,
      data: {
        amountPaise: '250000',
        from: 'Asha Rao',
        accountId: to.id,
        account: `•••• ${to.accountNumber.slice(-4)}`,
      },
    });
    // The sender isn't notified about their own payment.
    expect((await list(asha)).items).toEqual([]);
  });

  it('says nothing about moving money between your own accounts', async () => {
    const savings = await openAccount(app, asha, 10_000_00);
    const current = await openAccount(app, asha, 0, 'CURRENT');
    await request(app)
      .post('/api/transfers')
      .set(asha)
      .set('Idempotency-Key', crypto.randomUUID())
      .send({
        fromAccountId: savings.id,
        toAccountNumber: current.accountNumber,
        amountPaise: 1_000_00,
      })
      .expect(201);

    expect((await list(asha)).items).toEqual([]);
  });

  it('reports a sign-in from a new browser, but not from a known one', async () => {
    await signIn(raviEmail, 'Laptop Chrome');
    await signIn(raviEmail, 'Laptop Chrome');
    await signIn(raviEmail, 'Phone Safari');

    const types = (await list(ravi)).items.map((n) => [n.type, n.data]);

    // Registering (supertest's own User-Agent) was the first sign-in: not news.
    expect(types).toEqual([
      ['NEW_DEVICE_SIGN_IN', { userAgent: 'Phone Safari' }],
      ['NEW_DEVICE_SIGN_IN', { userAgent: 'Laptop Chrome' }],
    ]);
  });

  it('reports security changes', async () => {
    await request(app)
      .post('/api/security/password')
      .set(ravi)
      .send({ currentPassword: 'secret123', newPassword: 'newsecret456' })
      .expect(204);

    expect((await list(ravi)).items[0].type).toBe('PASSWORD_CHANGED');
  });

  it('tells the owner when the bank freezes and unfreezes an account', async () => {
    const account = await openAccount(app, ravi);
    const { auth: admin } = await signUpAdmin(app);
    for (const status of ['FROZEN', 'ACTIVE']) {
      await request(app)
        .patch(`/api/admin/accounts/${account.id}/status`)
        .set(admin)
        .send({ status, reason: 'Customer asked' })
        .expect(200);
    }

    expect((await list(ravi)).items.map((n) => n.type)).toEqual([
      'ACCOUNT_UNFROZEN',
      'ACCOUNT_FROZEN',
    ]);
  });

  it('gives the shared demo login no sign-in notifications', async () => {
    await UserModel.updateOne({ _id: raviId }, { demo: true });
    await signIn(raviEmail, 'Some visitor on Firefox');

    expect((await list(ravi)).items).toEqual([]);
  });

  it('marks one or all as read, and summarises what is new', async () => {
    expect(await summary(ravi)).toEqual({ unreadCount: 0, latestId: null });
    await payRavi(1_000_00);
    await signIn(raviEmail, 'Phone Safari');
    const { items } = await list(ravi);

    expect(await summary(ravi)).toEqual({
      unreadCount: 2,
      latestId: items[0].id,
    });

    await request(app)
      .post(`/api/notifications/${items[1].id}/read`)
      .set(ravi)
      .expect(204);
    expect((await summary(ravi)).unreadCount).toBe(1);

    await request(app)
      .post('/api/notifications/read-all')
      .set(ravi)
      .expect(204);
    const after = await list(ravi);
    expect(after.unreadCount).toBe(0);
    expect(after.items.every((n) => n.read)).toBe(true);
  });

  it("can't touch someone else's notifications", async () => {
    await payRavi(1_000_00);
    const [notification] = (await list(ravi)).items;

    await request(app)
      .post(`/api/notifications/${notification.id}/read`)
      .set(asha)
      .expect(404);
    expect(
      (await NotificationModel.findById(notification.id))?.readAt,
    ).toBeUndefined();
  });
});
