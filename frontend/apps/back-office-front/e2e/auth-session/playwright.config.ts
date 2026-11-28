import { defineConfig } from '@playwright/test';
import path from 'node:path';

const backOffice = path.resolve(__dirname, '../..');
const core = path.resolve(backOffice, '../core-front');
const api = 'http://localhost:4892';
const env = {
  AUTH_COOKIE_ENV: 'stage',
  AUTH_COOKIE_DOMAIN: '',
  BO_DEV_BYPASS_AUTH: '0',
  NEXT_PUBLIC_DEV_BYPASS_AUTH: '0',
  NEXT_PUBLIC_API_MOCKING: 'disabled',
  API_BASE_URL: api,
  NEXT_PUBLIC_API_BASE_URL: api,
  NEXT_TELEMETRY_DISABLED: '1',
};

export default defineConfig({
  testDir: __dirname,
  testMatch: 'session.spec.ts',
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 30_000 },
  reporter: 'list',
  use: { browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'node e2e/auth-session/mock-api.mjs',
      cwd: backOffice,
      url: `${api}/health`,
      reuseExistingServer: false,
    },
    {
      command: './node_modules/.bin/next dev --webpack -p 4890',
      cwd: core,
      url: 'http://localhost:4890/api/auth/refresh',
      env,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: './node_modules/.bin/next dev --webpack -p 4891',
      cwd: backOffice,
      url: 'http://localhost:4891/login',
      env,
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
