import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('API_BASE_URL', 'http://internal-api.test');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('사이트 공지 서버 조회', () => {
  it('내부 API 주소와 no-store를 사용하고 페이지 조건을 유지한다', async () => {
    const page = { items: [], total: 0, offset: 20, limit: 10 };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(page));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchNotices } = await import('./repository');
    expect(await fetchNotices(20, 10)).toEqual(page);
    expect(fetchMock).toHaveBeenCalledWith('http://internal-api.test/api/notices?offset=20&limit=10', { cache: 'no-store' });
  });

  it.each([400, 404])('%s 상세 응답은 없는 공지로 처리한다', async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status }));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchNotice } = await import('./repository');
    expect(await fetchNotice('a/b')).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('http://internal-api.test/api/notices/a%2Fb', { cache: 'no-store' });
  });

  it('서버 오류는 없는 공지로 바꾸지 않고 던진다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    const { fetchNotice, fetchNotices } = await import('./repository');
    await expect(fetchNotice('12')).rejects.toThrow('GET /api/notices/12 failed: 500');
    await expect(fetchNotices(0, 10)).rejects.toThrow('GET /api/notices failed: 500');
  });
});
