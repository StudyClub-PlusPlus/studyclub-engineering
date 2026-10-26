import { afterEach, describe, expect, it, vi } from 'vitest';

import { httpClient } from '.';
import { ApiError } from '@/lib/http';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(res: Response) {
  const fetch = vi.fn().mockResolvedValue(res);
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('httpClient', () => {
  it('get 은 값이 있는 params 만 쿼리스트링으로 붙인다 — boolean 은 문자열로', async () => {
    const fetch = stubFetch(new Response(JSON.stringify({ ok: 1 })));
    await expect(
      httpClient.get('/api/x', { params: { studyGroupId: 3, includeWithdrawn: true, q: '', none: null } }),
    ).resolves.toEqual({ ok: 1 });
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/x\?studyGroupId=3&includeWithdrawn=true$/);
    expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
  });

  it('쓰기는 JSON 본문을 싣고, 204 는 null 로 돌아온다', async () => {
    const fetch = stubFetch(new Response(null, { status: 204 }));
    await expect(httpClient.delete('/api/x', { data: { ids: [1] } })).resolves.toBeNull();
    expect(fetch.mock.calls[0][1]).toMatchObject({
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: '{"ids":[1]}',
    });
  });

  it('오류 응답은 서버 문구를 담은 ApiError 로 던진다', async () => {
    stubFetch(
      new Response(JSON.stringify({ errorCode: 'FORBIDDEN', errorMessage: '권한이 없습니다.' }), { status: 403 }),
    );
    await expect(httpClient.post('/api/x', {})).rejects.toEqual(new ApiError(403, '권한이 없습니다.'));
  });
});
