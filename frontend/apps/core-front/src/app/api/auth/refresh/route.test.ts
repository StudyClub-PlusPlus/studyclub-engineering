// @vitest-environment node
import { NextRequest } from 'next/server';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let GET: typeof import('./route').GET;
let POST: typeof import('./route').POST;

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv('AUTH_COOKIE_ENV', 'stage');
  ({ GET, POST } = await import('./route'));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function request(next: string, refresh?: string) {
  return new NextRequest(`https://localhost:3000/api/auth/refresh?next=${encodeURIComponent(next)}`, {
    headers: refresh ? { cookie: `sc_stage_refresh_token=${refresh}` } : {},
  });
}

it.each(['/ko/my', '/en/my/studies?tab=schedule', '/ko/onboarding?next=%2Fko%2Fstudies'])(
  '유효한 refresh로 갱신한 뒤 프록시 내부 주소가 아닌 원래 화면 %s로 돌아간다',
  async (next) => {
    const fetchMock = vi.fn(async () => Response.json({ accessToken: 'new-access', accessTokenExpiresIn: 900 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET(request(next, 'valid-refresh'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(next);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.cookies.get('sc_stage_access_token')).toMatchObject({
      value: 'new-access',
      maxAge: 900,
      path: '/',
      httpOnly: true,
    });
    expect(response.cookies.get('sc_stage_refresh_token')).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ refreshToken: 'valid-refresh' }),
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      }),
    );
  },
);

it.each(['ko', 'en'])('refresh가 없으면 %s 로그인으로 보내고 백엔드는 호출하지 않는다', async (locale) => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const next = `/${locale}/my?tab=profile`;
  const response = await GET(request(next));
  expect(response.headers.get('location')).toBe(`/${locale}/login?next=${encodeURIComponent(next)}`);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('refresh가 거절되면 해당 앱과 환경의 쿠키만 삭제한다', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 401 })),
  );
  const response = await GET(request('/en/my', 'revoked'));
  expect(response.headers.get('location')).toBe('/en/login?next=%2Fen%2Fmy');
  expect(response.cookies.get('sc_stage_access_token')).toMatchObject({ value: '', maxAge: 0, path: '/' });
  expect(response.cookies.get('sc_stage_refresh_token')).toMatchObject({ value: '', maxAge: 0, path: '/api/auth' });
  expect(response.cookies.get('bo_stage_refresh_token')).toBeUndefined();
});

it.each([429, 500, 502, 503, 504])('갱신 서버의 %i 오류는 쿠키를 보존하고 원래 오류로 응답한다', async (status) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status })),
  );
  for (const handler of [GET, POST]) {
    const response = await handler(request('/ko/my', 'valid-refresh'));
    expect(response.status).toBe(status);
    expect(response.headers.has('set-cookie')).toBe(false);
    expect(response.headers.has('location')).toBe(false);
    expect(response.headers.get('cache-control')).toContain('no-store');
  }
});

it('연결이 끊겨도 쿠키를 보존하고 영문 재시도 링크에 원래 경로를 유지한다', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
  const response = await GET(request('/en/my?tab=profile', 'valid-refresh'));
  expect(response.status).toBe(502);
  expect(response.headers.has('set-cookie')).toBe(false);
  expect(response.headers.has('location')).toBe(false);
  const html = await response.text();
  expect(html).toContain('Try again');
  expect(html).toContain('/api/auth/refresh?next=%2Fen%2Fmy%3Ftab%3Dprofile');
});

it.each([
  '//evil.example',
  '/\\evil.example',
  'https://evil.example',
  '/\t/evil.example',
  '/ko/..//evil.example',
  '/api/auth/refresh',
  '/ko/../../api/auth/refresh',
])('잘못된 복귀 주소 %s는 기본 마이페이지로 제한한다', async (next) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ accessToken: 'new-access' })),
  );
  const response = await GET(request(next, 'valid-refresh'));
  expect(response.headers.get('location')).toBe('/ko/my');
});

it.each([0, -1])('잘못된 토큰 수명 %i는 쿠키를 덮어쓰지 않는다', async (ttl) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ accessToken: 'new-access', accessTokenExpiresIn: ttl })),
  );
  const response = await POST(request('/ko/my', 'valid-refresh'));
  expect(response.status).toBe(502);
  expect(response.headers.has('set-cookie')).toBe(false);
});

it('POST 갱신은 토큰을 JSON에 노출하지 않고 access 쿠키만 갱신한다', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ accessToken: 'new-access', accessTokenExpiresIn: 900 })),
  );
  const response = await POST(request('/ko/my', 'valid-refresh'));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(response.cookies.get('sc_stage_access_token')?.maxAge).toBe(900);
});
