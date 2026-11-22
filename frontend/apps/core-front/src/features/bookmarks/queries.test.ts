import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchMyBookmarkIds, saveBookmark } from './queries';
import { BOOKMARK_KEY, setBookmarked } from './storage';
import { clearSession } from '@/features/auth/auth';
import { API_BASE } from '@/lib/http';

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === null ? '' : JSON.stringify(body)),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('관심 스터디 서버 저장', () => {
  it('목록은 studyId 를 문자열로 바꿔 담은 순서대로 돌려준다', async () => {
    const fetch = respond(200, {
      items: [
        { studyId: 3, title: 'a', category: 'AI' },
        { studyId: 12, title: 'b', category: 'AI' },
      ],
      total: 2,
      offset: 0,
      limit: 100,
    });
    vi.stubGlobal('fetch', fetch);
    await expect(fetchMyBookmarkIds()).resolves.toEqual(['3', '12']);
    expect(fetch.mock.calls[0][0]).toBe(`${API_BASE}/api/me/bookmarks?limit=100`);
  });

  it('담기는 POST, 빼기는 DELETE 로 부른다', async () => {
    const fetch = respond(204, null);
    vi.stubGlobal('fetch', fetch);
    await saveBookmark('7', true);
    await saveBookmark('7', false);
    expect(fetch.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      [`${API_BASE}/api/me/bookmarks/7`, 'POST'],
      [`${API_BASE}/api/me/bookmarks/7`, 'DELETE'],
    ]);
  });
});

describe('로그아웃', () => {
  it('이 브라우저에 담아 둔 하트를 지운다', () => {
    setBookmarked('1', true);
    clearSession();
    expect(localStorage.getItem(BOOKMARK_KEY)).toBeNull();
  });
});
