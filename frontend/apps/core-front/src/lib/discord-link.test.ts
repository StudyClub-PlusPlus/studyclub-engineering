import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

const httpMock: Mock<(path: string, init?: RequestInit) => Promise<null>> = vi.fn(async () => null);
const setQueryData = vi.fn();
const invalidateQueries = vi.fn(async () => undefined);

vi.mock('./http', () => ({
  http: (path: string, init?: RequestInit) => httpMock(path, init),
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

const trackMock = vi.fn();
vi.mock('@/lib/analytics', () => ({ track: (e: unknown) => trackMock(e) }));

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
    trackMock.mockClear();
  });

  it('성공 후 계정 캐시를 낙관 갱신하고 무효화한다', async () => {
    const { linkDiscord } = await import('./discord');
    await linkDiscord(12, 'code-abc', 'my_page');

    expect(httpMock).toHaveBeenCalledWith('/api/me/discord/link', expect.objectContaining({ method: 'POST' }));
    expect(setQueryData).toHaveBeenCalled();
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['profile', 'account', 12] });
  });

  it('204 를 받으면 연동한 화면을 source 로 붙여 My Discord Connected 를 보낸다', async () => {
    const { linkDiscord } = await import('./discord');
    await linkDiscord(12, 'code-abc', 'apply_gate');

    expect(trackMock).toHaveBeenCalledWith({ name: 'My Discord Connected', props: { source: 'apply_gate' } });
  });

  it('연동 API 가 실패하면 성공 대신 실패를 사유와 함께 보내고 에러는 그대로 던진다', async () => {
    const { ApiError } = await import('./http');
    httpMock.mockRejectedValueOnce(new ApiError(403, 'not in guild', { errorCode: 'DISCORD_NOT_IN_GUILD' }));
    const { linkDiscord } = await import('./discord');
    await expect(linkDiscord(12, 'code-abc', 'onboarding')).rejects.toThrow();

    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith({
      name: 'Discord Connect Failed',
      props: { source: 'onboarding', reason: 'not_in_guild', http_status: 403 },
    });
  });

  it('팝업 단계 실패(창 닫기)도 센다 — API 는 부르지 않는다', async () => {
    const { linkDiscord, DiscordPopupError } = await import('./discord');
    await expect(linkDiscord(12, Promise.reject(new DiscordPopupError('cancelled')), 'my_page')).rejects.toThrow();

    expect(httpMock).not.toHaveBeenCalled();
    expect(trackMock).toHaveBeenCalledWith({
      name: 'Discord Connect Failed',
      props: { source: 'my_page', reason: 'cancelled', http_status: null },
    });
  });

  it('409 는 이미 다른 계정에 연결된 디스코드다', async () => {
    const { ApiError } = await import('./http');
    httpMock.mockRejectedValueOnce(new ApiError(409, 'conflict'));
    const { linkDiscord } = await import('./discord');
    await expect(linkDiscord(12, 'code-abc', 'apply_gate')).rejects.toThrow();

    expect(trackMock).toHaveBeenCalledWith({
      name: 'Discord Connect Failed',
      props: { source: 'apply_gate', reason: 'already_linked', http_status: 409 },
    });
  });
});
