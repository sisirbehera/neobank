import request from 'supertest';
import { createApp } from '../../app';
import { testConfig } from '../../test/test-config';
import { DOCUMENTED_OPERATIONS } from './openapi';

describe('API docs', () => {
  const app = createApp(testConfig());

  it('serves an OpenAPI 3.1 document generated from the Zod schemas', async () => {
    const res = await request(app).get('/api/docs/openapi.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    const paths = new Set(DOCUMENTED_OPERATIONS.map((o) => o.path));
    expect(Object.keys(res.body.paths)).toHaveLength(paths.size);
    expect(DOCUMENTED_OPERATIONS).toHaveLength(39);

    // Spot-check that real validation rules made it into the docs.
    const register =
      res.body.paths['/auth/register'].post.requestBody.content[
        'application/json'
      ].schema;
    expect(register.properties.password.minLength).toBe(8);
    expect(register.required).toEqual(['name', 'email', 'password']);

    const transfer = res.body.paths['/transfers'].post;
    expect(transfer.parameters.map((p: { name: string }) => p.name)).toEqual([
      'Idempotency-Key',
      'X-Step-Up-Token',
    ]);
    expect(transfer.security).toEqual([{ bearerAuth: [] }]);

    const history = res.body.paths['/transactions'].get.parameters.map(
      (p: { name: string }) => p.name,
    );
    expect(history).toEqual(
      expect.arrayContaining(['accountId', 'type', 'from', 'to', 'q', 'page']),
    );
  });

  it('documents only routes that exist', async () => {
    for (const { method, path } of DOCUMENTED_OPERATIONS) {
      const url = `/api${path.replace(/\{\w+\}/g, '000000000000000000000000')}`;
      const res = await request(app)[method](url).send({});
      // Our 404 for unknown routes says "No route for …"; anything else
      // (401, 400, 404 "Account not found", …) means the route is there.
      expect(res.body?.error?.message ?? '', `${method} ${path}`).not.toMatch(
        /^No route/,
      );
    }
  });

  it('serves Swagger UI under the CSP, pointed at our document', async () => {
    const redirect = await request(app).get('/api/docs');
    expect(redirect.status).toBe(301);
    expect(redirect.headers.location).toBe('/api/docs/');

    const page = await request(app).get('/api/docs/');
    expect(page.status).toBe(200);
    expect(page.text).toContain('swagger-ui-bundle.js');
    expect(page.headers['content-security-policy']).toContain(
      "script-src 'self'",
    );

    const init = await request(app).get('/api/docs/swagger-initializer.js');
    expect(init.text).toContain('/api/docs/openapi.json');
  });
});
