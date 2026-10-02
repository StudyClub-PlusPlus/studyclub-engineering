// @vitest-environment node

import { NextRequest } from 'next/server';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';
import { ACCESS_COOKIE } from '@/lib/auth';

const tokens = {
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  accessTokenExpiresIn: 3600,
};
const admin = { id: 1, role: 'ADMIN', onboardingCompletedAt: null };
const fetchMock = vi.fn<typeof fetch>();

function request(body: Record<string, unknown> = { code: 'test-code', platform: 'CORE' }) {
  return new NextRequest('http://localhost/api/auth/social/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('백오피스 로그인 관리자 검사', () => {
  it('account 응답의 ADMIN은 온보딩 미완료여도 로그인 쿠키를 받는다', async () => {
    fetchMock.mockResolvedValue(Response.json({ ...tokens, account: admin }));

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.account).toEqual(admin);
    expect(body).not.toHaveProperty('user');
    expect(response.cookies.get(ACCESS_COOKIE)).toMatchObject({
      value: tokens.accessToken,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 3600,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toEqual(expect.stringMatching(/\/auth\/social-login$/));
    expect(JSON.parse(init!.body as string)).toEqual({
      code: 'test-code',
      provider: 'google',
      platform: 'BACK_OFFICE',
    });
  });

  it.each([
    ['MEMBER', { account: { id: 1, role: 'MEMBER' } }],
    ['권한 누락', { account: { id: 1 } }],
    ['계정 누락', {}],
    ['account가 null', { account: null }],
  ])('%s이면 쿠키 없이 거절한다', async (_label, payload) => {
    fetchMock.mockResolvedValue(Response.json({ ...tokens, ...payload }));

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      errorCode: 'FORBIDDEN',
      errorMessage: '백오피스 운영 권한이 없는 계정입니다.',
    });
    expect(response.headers.has('set-cookie')).toBe(false);
  });

  it('서버의 403은 account에 ADMIN이 있어도 그대로 전달하고 쿠키를 발급하지 않는다', async () => {
    const error = { errorCode: 'FORBIDDEN', errorMessage: '운영 권한이 없습니다.', account: admin };
    fetchMock.mockResolvedValue(Response.json(error, { status: 403 }));

    const response = await POST(request());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual(error);
    expect(response.headers.has('set-cookie')).toBe(false);
  });

  it('인증 코드가 없으면 서버를 호출하지 않는다', async () => {
    const response = await POST(request({}));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.has('set-cookie')).toBe(false);
  });

  it('서버에 연결하지 못하면 502를 반환하고 쿠키를 발급하지 않는다', async () => {
    fetchMock.mockRejectedValue(new TypeError('test connection failure'));

    const response = await POST(request());

    expect(response.status).toBe(502);
    expect(response.headers.has('set-cookie')).toBe(false);
  });
});
