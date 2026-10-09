import request from 'supertest';
import { BeneficiaryDtoSchema } from '@neobank/shared/models';
import { createApp } from '../../app';
import { signUp } from '../../test/test-auth';
import { testConfig } from '../../test/test-config';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/test-db';
import { openAccount } from '../../test/test-money';

describe('beneficiaries API', () => {
  const app = createApp(testConfig());
  let auth: { Authorization: string };
  let otherAccountNumber: string;

  beforeAll(startTestDb, 60_000);
  afterAll(stopTestDb);
  beforeEach(async () => {
    await clearTestDb();
    ({ auth } = await signUp(app, 'Asha Rao'));
    const other = await signUp(app, 'Ravi Kumar');
    ({ accountNumber: otherAccountNumber } = await openAccount(
      app,
      other.auth,
    ));
  });

  const add = (body: object) =>
    request(app).post('/api/beneficiaries').set(auth).send(body);

  it('adds a beneficiary, accepting spaced and lower-case input', async () => {
    const spaced = otherAccountNumber
      .replace(/^(.{4})(.{4})/, '$1 $2 ')
      .toLowerCase();

    const res = await add({
      name: 'Ravi',
      accountNumber: spaced,
      nickname: 'Brother',
    });

    expect(res.status).toBe(201);
    expect(BeneficiaryDtoSchema.parse(res.body)).toMatchObject({
      name: 'Ravi',
      accountNumber: otherAccountNumber,
      nickname: 'Brother',
    });

    const list = await request(app).get('/api/beneficiaries').set(auth);
    expect(list.body).toHaveLength(1);
  });

  it('rejects a mistyped account number', async () => {
    const typo =
      otherAccountNumber.slice(0, -1) +
      ((Number(otherAccountNumber.at(-1)) + 1) % 10);

    const res = await add({ name: 'Ravi', accountNumber: typo });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.accountNumber[0]).toContain('not valid');
  });

  it('rejects a valid number that no account has', async () => {
    // Valid check digit, but (almost certainly) not issued.
    const res = await add({ name: 'Ghost', accountNumber: 'NB0000000000' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('rejects your own account and duplicates', async () => {
    const mine = await openAccount(app, auth);
    expect(
      (await add({ name: 'Me', accountNumber: mine.accountNumber })).status,
    ).toBe(400);

    await add({ name: 'Ravi', accountNumber: otherAccountNumber }).expect(201);
    const duplicate = await add({
      name: 'Ravi again',
      accountNumber: otherAccountNumber,
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('BENEFICIARY_EXISTS');
  });

  it('removes a beneficiary, but only your own', async () => {
    const { id } = (
      await add({ name: 'Ravi', accountNumber: otherAccountNumber })
    ).body;
    const stranger = await signUp(app, 'Stranger');

    const notMine = await request(app)
      .delete(`/api/beneficiaries/${id}`)
      .set(stranger.auth);
    expect(notMine.status).toBe(404);

    const res = await request(app).delete(`/api/beneficiaries/${id}`).set(auth);
    expect(res.status).toBe(204);
    expect(
      (await request(app).get('/api/beneficiaries').set(auth)).body,
    ).toEqual([]);
  });
});
