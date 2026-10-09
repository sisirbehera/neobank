import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

describe('serving the Angular app', () => {
  const dir = mkdtempSync(join(tmpdir(), 'neobank-web-'));
  writeFileSync(
    join(dir, 'index.html'),
    '<!doctype html><title>NeoBank</title>',
  );
  writeFileSync(join(dir, 'chunk-D-aySZ6s.js'), 'console.log(1);'.repeat(200));
  writeFileSync(join(dir, 'favicon.ico'), 'icon');
  const app = createApp({ ...testConfig(), staticDir: dir });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('caches hashed bundles for a year and compresses them', async () => {
    const res = await request(app)
      .get('/chunk-D-aySZ6s.js')
      .set('Accept-Encoding', 'gzip');

    expect(res.headers['cache-control']).toBe(
      'public, max-age=31536000, immutable',
    );
    expect(res.headers['content-encoding']).toBe('gzip');
  });

  it('never caches index.html, so a deploy is picked up immediately', async () => {
    const deepLink = await request(app).get('/accounts/123');

    expect(deepLink.status).toBe(200);
    expect(deepLink.text).toContain('<title>NeoBank</title>');
    expect(deepLink.headers['cache-control']).toBe('no-cache');
    expect(
      (await request(app).get('/favicon.ico')).headers['cache-control'],
    ).toBe('no-cache');
  });

  it('never lets API responses be cached', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
