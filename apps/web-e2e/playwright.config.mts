import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';
const PRODUCTION_URL = 'http://localhost:4300';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import 'dotenv/config';

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * Generated as a .mts file so Node forces ESM regardless of workspace
 * `type`. Playwright routes `.mts` through its ESM loader (dynamic import,
 * bypassing the pirates CJS-compile path), and Nx's native TS strip loads
 * `.mts` directly. Playwright's configLoader auto-discovers
 * `playwright.config.mts` via its extension list
 * (.ts/.js/.mts/.mjs/.cts/.cjs).
 */
export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npx nx run web:serve',
      // Through the dev-server proxy: 200 only once Angular, the API and the
      // database are all up (the API starts slower than the dev server).
      url: 'http://localhost:4200/api/health',
      timeout: 180_000,
      reuseExistingServer: true,
      cwd: workspaceRoot,
      // Every test logs in from the same IP; don't let the login rate limit
      // (meant for real users) fail the suite.
      env: { AUTH_RATE_LIMIT: '1000' },
    },
    // The production build, served by the API the way Render runs it: both
    // languages under /en/ and /hi/ (the dev server has only one).
    // The API is built into its own folder (configuration "e2e"): the dev API
    // runs from apps/api/dist and restarts, losing its in-memory database,
    // whenever that folder changes.
    {
      command:
        'npx nx build web --configuration=production && npx nx build api --configuration=e2e && node dist/e2e/api/main.js',
      url: `${PRODUCTION_URL}/api/health`,
      timeout: 300_000,
      reuseExistingServer: !process.env['CI'],
      cwd: workspaceRoot,
      env: {
        PORT: '4300',
        STATIC_DIR: 'dist/apps/web/browser',
        SEED_DEMO_DATA: 'true',
        AUTH_RATE_LIMIT: '1000',
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /production\//,
    },
    {
      name: 'production',
      use: { ...devices['Desktop Chrome'], baseURL: PRODUCTION_URL },
      testMatch: /production\/.*\.spec\.ts/,
    },

    // Add 'firefox' / 'webkit' here once `npx playwright install` has them.

    // Uncomment for mobile browsers support
    /* {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    }, */

    // Uncomment for branded browsers
    /* {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    } */
  ],
});
