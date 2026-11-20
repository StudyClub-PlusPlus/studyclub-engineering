import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadAnalyticsSettings, registerAnalyticsBrowser } from './repository';

afterEach(() => vi.unstubAllGlobals());

describe('분석 설정 인증 갱신', () => {
  it.each([
    ['설정 조회', loadAnalyticsSettings],
    ['브라우저 등록', () => registerAnalyticsBrowser('123.456')],
  ])('%s는 액세스 만료 시 갱신 후 재시도한다', async (_, request) => {
    const settings = { userId: 'test-analytics-id', enabled: true, optedOutAt: null };
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(settings)));
    vi.stubGlobal('fetch', fetch);
    await expect(request()).resolves.toEqual(settings);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[1][0]).toBe('/api/auth/refresh');
    expect(fetch.mock.calls[2][0]).toBe(fetch.mock.calls[0][0]);
  });
});
