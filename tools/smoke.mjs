#!/usr/bin/env node
// Smoke test for a running NeoBank (local production build or the live site).
//
//   npm run smoke -- https://neobank-xyz.onrender.com
//   npm run smoke -- http://localhost:3333
//
// Read-only except for one demo login. Waits up to 2 minutes for a sleeping
// free-tier service to wake up. Exits 1 if any check fails.

import { createHash } from 'node:crypto';

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
// "/" sends visitors to their language: the cookie, then Accept-Language.
const root = await fetch(`${base}/`, {
  redirect: 'manual',
  headers: { 'Accept-Language': 'hi-IN,hi;q=0.9,en;q=0.8' },
});
check(
  'GET / sends a Hindi browser to /hi/',
  root.status === 302 && root.headers.get('location') === '/hi/',
  `${root.status} → ${root.headers.get('location')}`,
);

const page = await fetch(`${base}/en/`, {
  headers: { 'Accept-Encoding': 'gzip, br' },
});
const html = await page.text();
check('GET /en/ serves the Angular app', page.ok && html.includes('<nb-root'));
check('HTML is not cached', page.headers.get('cache-control') === 'no-cache');
const csp = page.headers.get('content-security-policy') ?? '';
const scriptSrc = /script-src ([^;]+)/.exec(csp)?.[1] ?? '';
check(
  'Content-Security-Policy blocks unknown inline scripts',
  scriptSrc.includes("'self'") && !scriptSrc.includes("'unsafe-inline'"),
);
// Each inline script the page needs (theme, event replay) must be allowed by
// its hash, or the browser silently refuses to run it.
const inline = [
  ...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi),
].filter(([, attrs]) => !/\bsrc\s*=|application\/json/i.test(attrs));
const missing = inline.filter(
  ([, , body]) =>
    !scriptSrc.includes(
      `'sha256-${createHash('sha256').update(body).digest('base64')}'`,
    ),
);
check(
  "The page's inline scripts are allowed by hash",
  inline.length > 0 && missing.length === 0,
  `${inline.length} inline, ${missing.length} not allowed`,
);

const login = await (await fetch(`${base}/en/login`)).text();
check(
  'GET /en/login is built ahead of time (content without JavaScript)',
  login.includes('Log in to NeoBank'),
);
const hindiLogin = await (await fetch(`${base}/hi/login`)).text();
check(
  'GET /hi/login is the Hindi page',
  hindiLogin.includes('NeoBank में लॉग इन करें') &&
    hindiLogin.includes('lang="hi"'),
);
const dashboard = await (await fetch(`${base}/en/dashboard`)).text();
check(
  'GET /en/dashboard is the browser-rendered shell',
  dashboard.includes('<nb-root') && !dashboard.includes('Log in to NeoBank'),
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
  const js = await fetch(new URL(bundle, page.url), {
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
  'Old links without a language still work',
  deepLink.ok &&
    new URL(deepLink.url).pathname === '/en/accounts/anything' &&
    (await deepLink.text()).includes('<nb-root'),
  new URL(deepLink.url).pathname,
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
