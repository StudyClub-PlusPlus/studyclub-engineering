import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('API_BASE_URL', 'http://internal-api.test');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('스터디 서버 조회', () => {
  it('내부 API 주소와 60초 ISR을 사용하고 검색 조건을 전달한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ items: [], total: 0, offset: 0, limit: 100 }));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchStudies } = await import('./repository');
    expect(await fetchStudies({ status: 'ongoing' })).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith('http://internal-api.test/api/studies?limit=100&status=ONGOING', { next: { revalidate: 60 } });
  });

  it('목록과 상세 오류의 상태 코드를 보존한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchStudies, fetchStudy } = await import('./repository');
    await expect(fetchStudies()).rejects.toThrow('GET /api/studies failed: 503');
    await expect(fetchStudy(7)).rejects.toThrow('GET /api/studies/7 failed: 503');
    expect(fetchMock).toHaveBeenLastCalledWith('http://internal-api.test/api/studies/7', { next: { revalidate: 60 } });
  });
});
