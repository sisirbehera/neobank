import request from 'supertest';
import type { Express } from 'express';

type Auth = { Authorization: string };

/** Opens an account for the user and optionally deposits into it. */
export async function openAccount(
  app: Express,
  auth: Auth,
  depositPaise = 0,
  type: 'SAVINGS' | 'CURRENT' = 'SAVINGS',
): Promise<{ id: string; accountNumber: string }> {
  const res = await request(app)
    .post('/api/accounts')
    .set(auth)
    .send({ type })
    .expect(201);

  if (depositPaise > 0) {
    // Deposits are capped at ₹1,00,000 each.
    for (let left = depositPaise; left > 0; left -= 1_00_000_00) {
      await request(app)
        .post(`/api/accounts/${res.body.id}/deposit`)
        .set(auth)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ amountPaise: Math.min(left, 1_00_000_00) })
        .expect(200);
    }
  }
  return { id: res.body.id, accountNumber: res.body.accountNumber };
}
