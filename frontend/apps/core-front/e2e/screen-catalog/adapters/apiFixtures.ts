import type { Page } from '@playwright/test';

import type { ApiFixture } from '../../../screen-catalog/types';

const APP_ORIGIN = `http://localhost:${process.env.APP_PORT ?? '4700'}`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': APP_ORIGIN,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'content-type, x-user-nickname',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
};

/**
 * recipe.api 의 고정 응답을 건다. 경로 · 메서드가 같은 요청만 가로채고 나머지는 그대로 보낸다.
 * MSW 가 그냥 보낸(bypass) 요청은 서비스 워커가 내보내 page.route 로는 안 잡힌다 — 컨텍스트에 건다(stubApiMe 와 같다).
 */
export async function stubApiFixtures(page: Page, fixtures: ApiFixture[]) {
  const paths = new Set(fixtures.map((f) => f.path));
  await page.context().route(
    (url) => paths.has(url.pathname),
    (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS });
      const path = new URL(request.url()).pathname;
      const fixture = fixtures.find((f) => f.path === path && (f.method ?? 'GET') === request.method());
      if (!fixture) return route.fallback();
      return route.fulfill({ status: fixture.status ?? 200, headers: CORS_HEADERS, json: fixture.json ?? null });
    },
  );
}
