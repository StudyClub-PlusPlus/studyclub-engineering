// @vitest-environment node
import { NextRequest } from 'next/server';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let middleware: typeof import('./middleware').middleware;

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv('AUTH_COOKIE_ENV', 'stage');
  ({ middleware } = await import('./middleware'));
});

afterEach(() => vi.unstubAllEnvs());

it.each(['/ko/my', '/en/my/studies?tab=schedule', '/ko/onboarding?next=%2Fko%2Fstudies'])(
  '액세스 쿠키가 만료된 %s 진입은 원래 주소를 보존해 갱신 경로로 보낸다',
  (path) => {
    const response = middleware(new NextRequest(`https://stage.studyclub.life${path}`));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      `https://stage.studyclub.life/api/auth/refresh?next=${encodeURIComponent(path)}`,
    );
  },
);

it('해당 환경의 액세스 쿠키가 있으면 보호 화면을 연다', () => {
  const request = new NextRequest('https://stage.studyclub.life/ko/my', {
    headers: { cookie: 'sc_access_token=production-token' },
  });
  expect(middleware(request).status).toBe(307);
  request.cookies.set('sc_stage_access_token', 'stage-token');
  expect(middleware(request).headers.get('x-middleware-next')).toBe('1');
});

it.each(['/ko/login', '/en/studies'])('공개 화면 %s는 갱신을 거치지 않는다', (path) => {
  expect(middleware(new NextRequest(`https://stage.studyclub.life${path}`)).headers.get('x-middleware-next')).toBe('1');
});
