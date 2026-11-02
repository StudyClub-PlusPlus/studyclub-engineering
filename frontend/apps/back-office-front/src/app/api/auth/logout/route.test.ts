// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllEnvs());

it('발급 때와 같은 환경·도메인·경로로 httpOnly 쿠키 둘 다 만료시킨다', async () => {
  vi.resetModules();
  vi.stubEnv('AUTH_COOKIE_ENV', 'stage');
  vi.stubEnv('AUTH_COOKIE_DOMAIN', '.studyclub.life');
  vi.stubEnv('NODE_ENV', 'production');
  const { POST } = await import('./route');
  const response = await POST();
  expect(response.cookies.get('bo_stage_access_token')).toMatchObject({
    value: '',
    domain: '.studyclub.life',
    path: '/',
    maxAge: 0,
    httpOnly: true,
    secure: true,
  });
  expect(response.cookies.get('bo_stage_refresh_token')).toMatchObject({
    value: '',
    domain: '.studyclub.life',
    path: '/api/auth',
    maxAge: 0,
    httpOnly: true,
    secure: true,
  });
  expect(response.cookies.get('bo_access_token')).toBeUndefined();
  expect(response.cookies.get('sc_stage_access_token')).toBeUndefined();
});
