import { defineConfig, type ReporterDescription } from '@playwright/test';
import path from 'node:path';

const APP_PORT = process.env.APP_PORT ?? '4701';
const APP_ORIGIN = `http://localhost:${APP_PORT}`;
const APP_ROOT = path.resolve(__dirname, '..');
const API_MOCK_PORT = process.env.APP_API_MOCK_PORT ?? '4702';
// 화면 카탈로그는 브라우저 조회를 MSW 목으로 받는다 — 우회 토큰으로 진짜 API 를 부르면 401 이라 로그인으로 튕긴다.
// 스모크는 page.route 로 진짜 API 를 가로채므로 켜지 않는다 (MSW 가 먼저 답한다). test:e2e:catalog 스크립트만 켠다.
const API_MOCKING = process.env.APP_API_MOCKING;

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
      // workers: 1 로 실행할 것 (뷰포트 전환이 전역 상태이므로 병렬 금지)
      name: 'screen-catalog',
      testDir: './screen-catalog/specs',
      snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'node e2e/mock-api.mjs',
      cwd: APP_ROOT,
      url: `http://127.0.0.1:${API_MOCK_PORT}/api/admin/studies?offset=0&limit=100`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `npm run dev -- --port ${APP_PORT}`,
      cwd: APP_ROOT,
      url: `${APP_ORIGIN}/studies`,
      env: {
        ...(process.env.APP_DIST_DIR ? { APP_DIST_DIR: process.env.APP_DIST_DIR } : {}),
        BO_DEV_BYPASS_AUTH: API_MOCKING ? '0' : '1',
        API_BASE_URL: `http://127.0.0.1:${API_MOCK_PORT}`,
        ...(API_MOCKING ? { NEXT_PUBLIC_API_MOCKING: API_MOCKING, NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8080' } : {}),
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
