// @vitest-environment node
import { NextRequest } from 'next/server';

import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it('발급 때와 같은 환경·도메인·경로로 httpOnly 쿠키 둘 다 만료시킨다', async () => {
  vi.resetModules();
  vi.stubEnv('AUTH_COOKIE_ENV', 'stage');
  vi.stubEnv('AUTH_COOKIE_DOMAIN', '.studyclub.life');
  vi.stubEnv('NODE_ENV', 'production');
  const { POST } = await import('./route');
  const req = new NextRequest('http://localhost/api/auth/logout', { method: 'POST' });
  const response = await POST(req);
  expect(response.cookies.get('sc_stage_access_token')).toMatchObject({
    value: '',
    domain: '.studyclub.life',
    path: '/',
    maxAge: 0,
    httpOnly: true,
    secure: true,
  });
  expect(response.cookies.get('sc_stage_refresh_token')).toMatchObject({
    value: '',
    domain: '.studyclub.life',
    path: '/api/auth',
    maxAge: 0,
    httpOnly: true,
    secure: true,
  });
  expect(response.cookies.get('bo_stage_access_token')).toBeUndefined();
});

it('refresh 쿠키가 있으면 백엔드 /auth/logout 을 호출한다', async () => {
  vi.resetModules();
  const mockFetch = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', mockFetch);
  vi.stubEnv('API_BASE_URL', 'http://api.test');
  const { POST } = await import('./route');
  const req = new NextRequest('http://localhost/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: 'sc_refresh_token=test-refresh-value' },
  });
  await POST(req);
  expect(mockFetch).toHaveBeenCalledWith(
    'http://api.test/auth/logout',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ refreshToken: 'test-refresh-value' }) }),
  );
});

it('백엔드 호출이 실패해도 쿠키는 만료시킨다', async () => {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
  vi.stubEnv('API_BASE_URL', 'http://api.test');
  const { POST } = await import('./route');
  const req = new NextRequest('http://localhost/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: 'sc_refresh_token=test-refresh-value' },
  });
  const response = await POST(req);
  expect(response.cookies.get('sc_access_token')).toMatchObject({ value: '', maxAge: 0 });
});

it('refresh 쿠키가 없으면 백엔드를 호출하지 않는다', async () => {
  vi.resetModules();
  const mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);
  const { POST } = await import('./route');
  const req = new NextRequest('http://localhost/api/auth/logout', { method: 'POST' });
  await POST(req);
  expect(mockFetch).not.toHaveBeenCalled();
});
