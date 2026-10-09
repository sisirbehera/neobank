import request from 'supertest';
import type { Express } from 'express';
import { UserModel } from '../modules/users/user.model';

let counter = 0;

/** Registers a fresh user and returns an Authorization header for them. */
export async function signUp(
  app: Express,
  name = 'Test User',
): Promise<{ auth: { Authorization: string }; userId: string; email: string }> {
  counter += 1;
  const email = `user${counter}-${Date.now()}@example.com`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password: 'secret123' })
    .expect(201);
  return {
    auth: { Authorization: `Bearer ${res.body.accessToken}` },
    userId: res.body.user.id,
    email,
  };
}

/** Registers a user, promotes them to admin and logs in again (fresh role claim). */
export async function signUpAdmin(
  app: Express,
): Promise<{ auth: { Authorization: string }; userId: string }> {
  const { email, userId } = await signUp(app, 'Admin User');
  await UserModel.updateOne({ _id: userId }, { role: 'admin' });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'secret123' })
    .expect(200);
  return { auth: { Authorization: `Bearer ${res.body.accessToken}` }, userId };
}
