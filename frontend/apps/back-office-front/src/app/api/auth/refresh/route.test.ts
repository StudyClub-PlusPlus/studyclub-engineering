// @vitest-environment node
import { NextRequest } from 'next/server';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let GET: typeof import('./route').GET;

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv('AUTH_COOKIE_ENV', 'stage');
  ({ GET } = await import('./route'));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function get(next: string, refresh?: string) {
  return new NextRequest(`https://back-office-stage.studyclub.life/api/auth/refresh?next=${encodeURIComponent(next)}`, {
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
  expect(response.headers.get('location')).toBe('https://back-office-stage.studyclub.life/feedbacks?page=2');
  expect(response.cookies.get('bo_stage_access_token')).toMatchObject({ value: 'new-access', maxAge: 900, path: '/' });
});

it('refresh 쿠키가 없으면 로그인으로 보낸다', async () => {
  const response = await GET(get('/feedbacks'));
  expect(response.headers.get('location')).toBe('https://back-office-stage.studyclub.life/login?next=%2Ffeedbacks');
});

it('refresh 가 거절되면 쿠키를 지우고 로그인으로 보낸다', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 401 })),
  );
  const response = await GET(get('/feedbacks', 'revoked'));
  expect(response.headers.get('location')).toBe('https://back-office-stage.studyclub.life/login?next=%2Ffeedbacks');
  expect(response.cookies.get('bo_stage_access_token')).toMatchObject({ value: '', maxAge: 0 });
  expect(response.cookies.get('bo_stage_refresh_token')).toMatchObject({ value: '', maxAge: 0 });
});

it.each(['//evil.example', '/\\evil.example', 'https://evil.example'])(
  'next 가 바깥 주소(%s)면 홈으로 보낸다',
  async (next) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ accessToken: 'new-access', accessTokenExpiresIn: 900 })),
    );
    const response = await GET(get(next, 'valid-refresh'));
    expect(response.headers.get('location')).toBe('https://back-office-stage.studyclub.life/');
  },
);
