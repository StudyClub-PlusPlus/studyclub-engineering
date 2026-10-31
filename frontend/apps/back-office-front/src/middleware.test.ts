// @vitest-environment node
import { NextRequest } from 'next/server';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let middleware: typeof import('./middleware').middleware;

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv('AUTH_COOKIE_ENV', 'stage');
  vi.stubEnv('BO_DEV_BYPASS_AUTH', '0');
  ({ middleware } = await import('./middleware'));
});

afterEach(() => vi.unstubAllEnvs());

it.each([undefined, 'server-rejected-token'])('로그인은 쿠키(%s)가 남아 있어도 대시보드로 보내지 않는다', (token) => {
  const request = new NextRequest('https://back-office-stage.studyclub.life/login?next=%2Ffeedbacks', {
    headers: token ? { cookie: `bo_stage_access_token=${token}` } : {},
  });
  const response = middleware(request);
  expect(response.headers.get('location')).toBeNull();
  expect(response.headers.get('x-middleware-next')).toBe('1');
});

it('쿠키가 없는 보호 화면은 여전히 로그인으로 보낸다', () => {
  const response = middleware(new NextRequest('https://back-office-stage.studyclub.life/feedbacks'));
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toBe('https://back-office-stage.studyclub.life/login?next=%2Ffeedbacks');
});

it('보호 화면의 쿠키는 해당 환경 이름으로만 확인한다', () => {
  const request = new NextRequest('https://back-office-stage.studyclub.life/feedbacks', {
    headers: { cookie: 'bo_access_token=production-token' },
  });
  expect(middleware(request).status).toBe(307);
  request.cookies.set('bo_stage_access_token', 'stage-token');
  expect(middleware(request).headers.get('x-middleware-next')).toBe('1');
});
