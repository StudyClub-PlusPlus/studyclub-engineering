import { defineConfig, type ReporterDescription } from '@playwright/test';
import path from 'node:path';

const APP_PORT = process.env.APP_PORT ?? '4700';
const APP_ORIGIN = `http://localhost:${APP_PORT}`;
const APP_ROOT = path.resolve(__dirname, '..');

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  reporter: (process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]]) as ReporterDescription[],
  use: {
    baseURL: APP_ORIGIN,
    navigationTimeout: 30_000,
    actionTimeout: 10_000,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'smoke',
      testDir: './specs',
      use: { browserName: 'chromium' },
    },
    {
      // 스크린 카탈로그 — 화면 상태별 비주얼 회귀 테스트
      // 리소스 사용과 fixture 실행 안정성을 위해 스크립트에서 workers: 1 사용
      name: 'screen-catalog',
      testDir: './screen-catalog/specs',
      snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    cwd: APP_ROOT,
    url: APP_ORIGIN,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
