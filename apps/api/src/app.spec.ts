import request from 'supertest';
import { ApiErrorSchema, HealthResponseSchema } from '@neobank/shared/models';
import { createApp } from './app';
import { testConfig } from './test/test-config';

describe('API app', () => {
  const app = createApp(testConfig());

  it('GET /api/health reports degraded when the database is not connected', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    const body = HealthResponseSchema.parse(res.body);
    expect(body).toMatchObject({
      status: 'degraded',
      db: 'down',
      version: 'test',
    });
  });

  it('returns a JSON 404 for unknown API routes', async () => {
    const res = await request(app).get('/api/nope');

    expect(res.status).toBe(404);
    expect(ApiErrorSchema.parse(res.body).error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{bad json');

    expect(res.status).toBe(400);
  });
});
