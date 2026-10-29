import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchNotices } from './api';
import { getNotices } from './content';

vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  fetchNotices: vi.fn(),
}));

const fetchNoticesMock = vi.mocked(fetchNotices);

beforeEach(() => {
  fetchNoticesMock.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('getNotices', () => {
  it('공지가 0건이면 빈 쪽을 그대로 준다', async () => {
    fetchNoticesMock.mockResolvedValue({ items: [], total: 0, offset: 0, limit: 10 });
    expect(await getNotices(0, 10)).toEqual({ items: [], total: 0, offset: 0, limit: 10 });
  });

  it('API 가 실패하면 빈 쪽이 아니라 null 을 준다 — 화면이 「공지 없음」과 구분해 오류 안내를 그린다', async () => {
    fetchNoticesMock.mockRejectedValue(new Error('GET /api/notices failed: 500'));
    expect(await getNotices(10, 10)).toBeNull();
  });
});
