import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { completeOnboarding } from '@/features/onboarding/repository';
import { checkNicknameAvailability } from '@/features/profile/nickname-repository';
import { API_BASE, ApiError, http } from '@/lib/http';

const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) => Response.json(body, { status });
const account = {
  id: 1,
  email: 'test@example.com',
  nickname: 'tester',
  picture: null,
  role: 'MEMBER',
  timeZone: 'Asia/Seoul',
  onboardingCompletedAt: null,
};
const payload = {
  age14Confirmed: true,
  termsOfServiceAgreed: true,
  privacyPolicyAgreed: true,
  marketingAgreed: false,
  nickname: 'tester',
  timeZone: 'Asia/Seoul',
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('direct account requests', () => {
  it('posts onboarding JSON directly to the backend with cookies', async () => {
    fetchMock.mockResolvedValueOnce(json(account));
    await expect(completeOnboarding(payload)).resolves.toEqual(account);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${API_BASE}/accounts/onboarding`);
    expect(init).toMatchObject({ method: 'POST', credentials: 'include', body: JSON.stringify(payload) });
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
  });

  it('preserves nickname query encoding and cancellation', async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValueOnce(json({ available: true }));
    await expect(checkNicknameAvailability('한 글', controller.signal)).resolves.toEqual({ available: true });
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/api/nicknames/availability?${new URLSearchParams({ value: '한 글' })}`,
      expect.objectContaining({ credentials: 'include', signal: controller.signal }),
    );
  });

  it('refreshes once and retries the identical onboarding request', async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ ok: true }))
      .mockResolvedValueOnce(json(account));
    await completeOnboarding(payload);
    expect(fetchMock.mock.calls[1]).toEqual(['/api/auth/refresh', { method: 'POST', signal: undefined }]);
    expect(fetchMock.mock.calls[2]).toEqual(fetchMock.mock.calls[0]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each([400, 409, 500])('preserves status %s, error message and code', async (status) => {
    const body = { errorCode: 'VALIDATION_ERROR', errorMessage: 'nickname: invalid' };
    fetchMock.mockResolvedValueOnce(json(body, status));
    await expect(completeOnboarding(payload)).rejects.toMatchObject({ status, message: body.errorMessage, body });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns the original 401 when refresh fails', async () => {
    fetchMock.mockResolvedValueOnce(json({ errorMessage: 'expired' }, 401)).mockResolvedValueOnce(json({}, 401));
    await expect(checkNicknameAvailability('tester')).rejects.toMatchObject({ status: 401, message: 'expired' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not refresh again when the retry is unauthorized', async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 401))
      .mockResolvedValueOnce(json({ ok: true }))
      .mockResolvedValueOnce(json({}, 401));
    await expect(completeOnboarding(payload)).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not change the refresh policy of other requests', async () => {
    fetchMock.mockResolvedValueOnce(json({}, 401));
    await expect(http('/api/me', z.null())).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('response validation', () => {
  it.each([{ available: 'true' }, {}, null])('rejects invalid successful nickname responses: %j', async (body) => {
    fetchMock.mockResolvedValueOnce(json(body));
    await expect(checkNicknameAvailability('tester')).rejects.toBeInstanceOf(z.ZodError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('rejects incomplete account responses before updating session state', async () => {
    fetchMock.mockResolvedValueOnce(json({ id: 1 }));
    await expect(completeOnboarding(payload)).rejects.toBeInstanceOf(z.ZodError);
  });
  it('accepts a genuine empty 204 response and rejects malformed JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(http('/empty', z.null())).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce(new Response('{broken', { status: 200 }));
    await expect(http('/empty', z.null())).rejects.toBeInstanceOf(SyntaxError);
  });
  it('does not serialize a malformed stored nickname into a request header', async () => {
    localStorage.setItem('sc_user', JSON.stringify({ nickname: { value: 'bad' } }));
    fetchMock.mockResolvedValueOnce(json({ available: true }));
    await checkNicknameAvailability('tester');
    expect(new Headers(fetchMock.mock.calls[0]![1]?.headers).has('x-user-nickname')).toBe(false);
  });
});
