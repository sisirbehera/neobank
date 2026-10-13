import request from 'supertest';
import { UserDtoSchema } from '@neobank/shared/models';
import { createApp } from '../../app';
import { signUp } from '../../test/test-auth';
import { testConfig } from '../../test/test-config';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/test-db';
import { UserModel } from '../users/user.model';

describe('profile: preferred language', () => {
  const app = createApp(testConfig());

  beforeAll(startTestDb, 60_000);
  afterAll(stopTestDb);
  beforeEach(clearTestDb);

  it('is unset until chosen, and can be changed', async () => {
    const { auth } = await signUp(app);
    const me = async () =>
      UserDtoSchema.parse(
        (await request(app).get('/api/auth/me').set(auth).expect(200)).body,
      );
    expect((await me()).language).toBeUndefined();

    const res = await request(app)
      .patch('/api/auth/me')
      .set(auth)
      .send({ language: 'hi' })
      .expect(200);

    expect(UserDtoSchema.parse(res.body).language).toBe('hi');
    expect((await me()).language).toBe('hi');
  });

  it('keeps the language of the page someone registered on', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Ravi Kumar',
        email: 'ravi@example.com',
        password: 'secret123',
        language: 'hi',
      })
      .expect(201);

    expect(res.body.user.language).toBe('hi');
  });

  it('rejects languages the app is not built in', async () => {
    const { auth } = await signUp(app);
    await request(app)
      .patch('/api/auth/me')
      .set(auth)
      .send({ language: 'fr' })
      .expect(400);
  });

  it("doesn't let one visitor change the shared demo login's language", async () => {
    const { auth, userId } = await signUp(app);
    await UserModel.updateOne({ _id: userId }, { demo: true });

    const res = await request(app)
      .patch('/api/auth/me')
      .set(auth)
      .send({ language: 'hi' })
      .expect(403);
    expect(res.body.error.code).toBe('DEMO_ACCOUNT');
  });
});
