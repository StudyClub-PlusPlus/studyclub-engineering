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

// 배포된 Next 서버는 프록시 뒤에서 요청 주소를 자기 주소(localhost:3000)로 본다
function get(next: string, refresh?: string) {
  return new NextRequest(`https://localhost:3000/api/auth/refresh?next=${encodeURIComponent(next)}`, {
    headers: refresh ? { cookie: `bo_stage_refresh_token=${refresh}` } : {},
  });
}

it('refresh 쿠키가 살아 있으면 액세스 쿠키를 새로 심고 보던 화면으로 돌려보낸다', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ accessToken: 'new-access', accessTokenExpiresIn: 900 })),
  );
  const response = await GET(get('/feedbacks?page=2', 'valid-refresh'));
  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toBe('/feedbacks?page=2');
  expect(response.cookies.get('bo_stage_access_token')).toMatchObject({ value: 'new-access', maxAge: 900, path: '/' });
});

it('refresh 쿠키가 없으면 로그인으로 보낸다', async () => {
  const response = await GET(get('/feedbacks'));
  expect(response.headers.get('location')).toBe('/login?next=%2Ffeedbacks');
});

it('refresh 가 거절되면 쿠키를 지우고 로그인으로 보낸다', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 401 })),
  );
  const response = await GET(get('/feedbacks', 'revoked'));
  expect(response.headers.get('location')).toBe('/login?next=%2Ffeedbacks');
  expect(response.cookies.get('bo_stage_access_token')).toMatchObject({ value: '', maxAge: 0 });
  expect(response.cookies.get('bo_stage_refresh_token')).toMatchObject({ value: '', maxAge: 0 });
});

it.each(['//evil.example', '/\\evil.example', 'https://evil.example', '/\t/evil.example', '/x/..//evil.example'])(
  'next 가 바깥 주소(%s)면 홈으로 보낸다',
  async (next) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ accessToken: 'new-access', accessTokenExpiresIn: 900 })),
    );
    const response = await GET(get(next, 'valid-refresh'));
    expect(response.headers.get('location')).toBe('/');
  },
);

it.each([429, 500, 502, 503, 504])('갱신 서버의 %i 오류는 쿠키를 지우거나 로그인으로 보내지 않는다', async (status) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status })),
  );
  for (const handler of [GET, POST]) {
    const response = await handler(get('/feedbacks?page=2', 'valid-refresh'));
    expect(response.status).toBe(status);
    expect(response.headers.has('set-cookie')).toBe(false);
    expect(response.headers.has('location')).toBe(false);
    expect(response.headers.get('cache-control')).toContain('no-store');
  }
});

it('갱신 연결이 끊겨도 쿠키를 보존하고 같은 화면으로 재시도할 수 있다', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
  const response = await GET(get('/feedbacks?page=2', 'valid-refresh'));
  expect(response.status).toBe(502);
  expect(response.headers.has('set-cookie')).toBe(false);
  expect(response.headers.has('location')).toBe(false);
  const html = await response.text();
  expect(html).toContain('다시 시도');
  expect(html).toContain('/api/auth/refresh?next=%2Ffeedbacks%3Fpage%3D2');
});

it.each([0, -1])('잘못된 토큰 수명 %i는 쿠키를 덮어쓰거나 로그인으로 보내지 않는다', async (ttl) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ accessToken: 'new-access', accessTokenExpiresIn: ttl })),
  );
  for (const handler of [GET, POST]) {
    const response = await handler(get('/feedbacks', 'valid-refresh'));
    expect(response.status).toBe(502);
    expect(response.headers.has('set-cookie')).toBe(false);
    expect(response.headers.has('location')).toBe(false);
  }
});

it('POST 갱신은 토큰을 JSON에 노출하지 않고 access 쿠키만 갱신한다', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ accessToken: 'new-access', accessTokenExpiresIn: 900 })),
  );
  const response = await POST(get('/feedbacks', 'valid-refresh'));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true });
  expect(response.cookies.get('bo_stage_access_token')?.maxAge).toBe(900);
  expect(response.cookies.get('bo_stage_refresh_token')).toBeUndefined();
});
