import { NextRequest } from 'next/server';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { REFRESH_COOKIE } from './auth';
import { POST as refresh } from '@/app/api/auth/refresh/route';
import { POST as login } from '@/app/api/auth/social/login/route';

afterEach(() => vi.unstubAllGlobals());
describe('auth proxy rejects malformed successful upstream responses', () => {
  it('does not write an access cookie for an invalid refresh response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ accessToken: 42 })));
    const response = await refresh(new NextRequest('https://study.test/api/auth/refresh', {
      method: 'POST', headers: { cookie: `${REFRESH_COOKIE}=refresh-token` },
    }));
    expect(response.status).toBe(502);
    expect(response.headers.has('set-cookie')).toBe(false);
  });
  it('does not write cookies for a token response with a malformed account', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ accessToken: 'access', account: { id: 1 } })));
    const response = await login(new NextRequest('https://study.test/api/auth/social/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'oauth-code' }),
    }));
    expect(response.status).toBe(502);
    expect(response.headers.has('set-cookie')).toBe(false);
  });
});
