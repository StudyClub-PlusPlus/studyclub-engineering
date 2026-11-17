import type { Page } from '@playwright/test';

const APP_ORIGIN = `http://localhost:${process.env.APP_PORT ?? '4700'}`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': APP_ORIGIN,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'content-type, x-user-nickname',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

/**
 * 진짜 GET /api/me 자리에 DSC-02 전 모양(discordLinked 없음)을 넣는다.
 * 시드한 sc_user 는 백엔드 세션이 아니라, 로컬 백엔드가 떠 있으면 진짜 응답이 401 이고 신청하기가 로그인으로 튕긴다.
 * 개발 서버의 MSW 목이 이 응답에 msw-discord-linked 값을 discordLinked 로 덧붙인다 — 백엔드가 떠 있든 아니든 같다.
 */
export async function stubApiMe(page: Page) {
  // MSW 의 bypass 요청은 서비스 워커가 보낸다 — page.route 로는 안 잡혀 컨텍스트에 건다
  await page.context().route(
    (url) => url.pathname === '/api/me',
    (route) => {
      const method = route.request().method();
      if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS });
      if (method !== 'GET') return route.fallback();
      return route.fulfill({
        status: 200,
        headers: CORS_HEADERS,
        json: {
          id: 1,
          email: 'test@test.com',
          nickname: '테스트크루',
          picture: null,
          role: 'MEMBER',
          timeZone: 'Asia/Seoul',
          onboardingCompletedAt: '2026-01-01T00:00:00Z',
          createdAt: '2026-01-01T00:00:00Z',
          discordNickname: null,
        },
      });
    },
  );

  // 마이페이지 수신 동의 — MSW 목이 없어 진짜 백엔드로 가면 401 이고, 401 은 세션을 지워 헤더가 「로그인」으로 바뀐다
  await page.context().route(
    (url) => url.pathname === '/api/me/marketing-consent',
    (route) => {
      const method = route.request().method();
      if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS_HEADERS });
      if (method !== 'GET') return route.fallback();
      return route.fulfill({ status: 200, headers: CORS_HEADERS, json: { agreed: false, agreedAt: null } });
    },
  );
}
