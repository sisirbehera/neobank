#!/usr/bin/env node
// Smoke test for a running NeoBank (local production build or the live site).
//
//   npm run smoke -- https://neobank-xyz.onrender.com
//   npm run smoke -- http://localhost:3333
//
// Read-only except for one demo login. Waits up to 2 minutes for a sleeping
// free-tier service to wake up. Exits 1 if any check fails.

const base = (process.argv[2] ?? 'http://localhost:3333').replace(/\/$/, '');
const https = base.startsWith('https://');
let failures = 0;

function check(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures += 1;
}

async function waitForHealth() {
  const deadline = Date.now() + 120_000;
  let last = '';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/health`);
      const body = await res.json();
      if (res.ok && body.db === 'up') return body;
      last = `${res.status} db=${body.db}`;
    } catch (err) {
      last = err.message;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Service did not become healthy: ${last}`);
}

console.log(`Smoke testing ${base}\n`);
const started = Date.now();
const health = await waitForHealth();
check(
  'API and database are up',
  true,
  `ready after ${Math.round((Date.now() - started) / 1000)}s, version ${health.version}`,
);

// ---- The web app --------------------------------------------------------------
const page = await fetch(`${base}/`, {
  headers: { 'Accept-Encoding': 'gzip, br' },
});
const html = await page.text();
check('GET / serves the Angular app', page.ok && html.includes('<nb-root'));
check(
  'index.html is not cached',
  page.headers.get('cache-control') === 'no-cache',
);
const csp = page.headers.get('content-security-policy') ?? '';
check(
  'Content-Security-Policy blocks inline scripts',
  csp.includes("script-src 'self'"),
);
check(
  'X-Content-Type-Options: nosniff',
  page.headers.get('x-content-type-options') === 'nosniff',
);
if (https) {
  check('HSTS is set', !!page.headers.get('strict-transport-security'));
}

const bundle = html.match(/src="(main-[A-Za-z0-9_-]{8}\.js)"/)?.[1];
if (bundle) {
  const js = await fetch(`${base}/${bundle}`, {
    headers: { 'Accept-Encoding': 'gzip, br' },
  });
  check(
    'Hashed bundles are cached for a year',
    (js.headers.get('cache-control') ?? '').includes('immutable'),
  );
  // fetch() decompresses transparently; the header still tells us it was compressed.
  check(
    'Bundles are compressed',
    /gzip|br/.test(js.headers.get('content-encoding') ?? ''),
    js.headers.get('content-encoding') ?? 'none',
  );
} else {
  check('Found the main bundle in index.html', false);
}

const deepLink = await fetch(`${base}/accounts/anything`);
check(
  'Deep links fall back to index.html',
  deepLink.ok && (await deepLink.text()).includes('<nb-root'),
);

// ---- The API -----------------------------------------------------------------
const docs = await fetch(`${base}/api/docs/openapi.json`);
check(
  'OpenAPI document is served',
  docs.ok && (await docs.json()).openapi === '3.1.0',
);

const anonymous = await fetch(`${base}/api/accounts`);
check('Protected routes reject anonymous requests', anonymous.status === 401);
check(
  'API responses are not cached',
  anonymous.headers.get('cache-control') === 'no-store',
);

if (health.demoMode) {
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@neobank.dev', password: 'Demo@1234' }),
  });
  const session = await login.json();
  check('Demo user can log in', login.ok && !!session.accessToken);

  const cookie = login.headers.get('set-cookie') ?? '';
  check(
    'Refresh cookie is HttpOnly + SameSite=Strict',
    /HttpOnly/i.test(cookie) && /SameSite=Strict/i.test(cookie),
  );
  if (https) check('Refresh cookie is Secure', /;\s*Secure/i.test(cookie));

  const accounts = await fetch(`${base}/api/accounts`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const list = await accounts.json();
  check(
    'Signed-in user sees their accounts',
    accounts.ok && list.length > 0,
    `${list.length} accounts`,
  );
} else {
  console.log('- demo mode is off: skipping the login checks');
}

console.log(
  `\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`,
);
process.exit(failures === 0 ? 0 : 1);
