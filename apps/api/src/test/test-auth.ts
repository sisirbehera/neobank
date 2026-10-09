import request from 'supertest';
import type { Express } from 'express';

let counter = 0;

/** Registers a fresh user and returns an Authorization header for them. */
export async function signUp(
  app: Express,
  name = 'Test User',
): Promise<{ auth: { Authorization: string }; userId: string }> {
  counter += 1;
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name,
      email: `user${counter}-${Date.now()}@example.com`,
      password: 'secret123',
    })
    .expect(201);
  return {
    auth: { Authorization: `Bearer ${res.body.accessToken}` },
    userId: res.body.user.id,
  };
}
