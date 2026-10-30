import { beforeEach, describe, expect, it, vi } from 'vitest';

const httpMock = vi.fn(async () => null);
const setQueryData = vi.fn();
const invalidateQueries = vi.fn(async () => undefined);

vi.mock('./http', () => ({
  http: (...args: [string, RequestInit?]) => httpMock(...args),
  ApiError: class ApiError extends Error {
    constructor(
      readonly status: number,
      message: string,
      readonly body?: unknown,
    ) {
      super(message);
    }
  },
}));

vi.mock('./query-client', () => ({
  getQueryClient: () => ({ setQueryData, invalidateQueries }),
}));

vi.mock('@/features/profile/queries', () => ({
  profileKeys: {
    all: ['profile'],
    account: (id: number) => ['profile', 'account', id],
  },
  fetchAccount: vi.fn(),
}));

describe('linkDiscord', () => {
  beforeEach(() => {
    httpMock.mockClear();
    setQueryData.mockClear();
    invalidateQueries.mockClear();
  });

  it('성공 후 계정 캐시를 낙관 갱신하고 무효화한다', async () => {
    const { linkDiscord } = await import('./discord');
    await linkDiscord(12, 'code-abc');

    expect(httpMock).toHaveBeenCalledWith('/api/me/discord/link', expect.objectContaining({ method: 'POST' }));
    expect(setQueryData).toHaveBeenCalled();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['profile', 'account', 12] });
  });
});
