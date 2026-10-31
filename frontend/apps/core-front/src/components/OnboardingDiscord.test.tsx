// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

const replace = vi.fn();
const invalidateQueries = vi.fn(async () => undefined);
const linkDiscordMock: Mock<(accountId: number, code: string) => Promise<undefined>> = vi.fn(
  async () => undefined,
);
const requestDiscordCodeMock = vi.fn(async () => 'oauth-code');
const fetchDiscordLinkStateMock: Mock<(accountId: number) => Promise<'unlinked'>> = vi.fn(
  async () => 'unlinked' as const,
);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
}));

vi.mock('@/lib/auth', () => ({
  getUser: () => ({
    id: 7,
    email: 'crew@example.com',
    nickname: '테스트',
    picture: null,
    role: 'MEMBER',
    onboardingCompletedAt: '2026-01-01T00:00:00Z',
  }),
  clearSession: vi.fn(),
}));

vi.mock('@/lib/discord', () => ({
  DISCORD_LINK_READY: true,
  DiscordPopupError: class DiscordPopupError extends Error {
    constructor(readonly reason: 'blocked' | 'cancelled') {
      super(reason);
    }
  },
  fetchDiscordLinkState: (accountId: number) => fetchDiscordLinkStateMock(accountId),
  linkDiscord: (accountId: number, code: string) => linkDiscordMock(accountId, code),
  requestDiscordCode: () => requestDiscordCodeMock(),
}));

vi.mock('@/lib/analytics', () => ({ track: vi.fn() }));

vi.mock('@/lib/query-client', () => ({
  getQueryClient: () => ({ invalidateQueries }),
}));

vi.mock('@/features/profile/queries', () => ({
  profileKeys: { account: (id: number) => ['profile', 'account', id] },
}));

describe('OnboardingDiscord', () => {
  beforeEach(() => {
    replace.mockReset();
    invalidateQueries.mockClear();
    linkDiscordMock.mockReset();
    linkDiscordMock.mockResolvedValue(undefined);
    requestDiscordCodeMock.mockClear();
    requestDiscordCodeMock.mockResolvedValue('oauth-code');
    fetchDiscordLinkStateMock.mockReset();
    fetchDiscordLinkStateMock.mockResolvedValue('unlinked');
  });

  afterEach(() => {
    cleanup();
  });

  it('연결 성공 후 계정 캐시를 무효화하고 next 로 이동한다', async () => {
    const { OnboardingDiscord } = await import('./OnboardingDiscord');
    const user = userEvent.setup();
    render(<OnboardingDiscord locale='ko' next='/ko/my' />);

    await screen.findByRole('button', { name: '지금 연결' });
    await user.click(screen.getByRole('button', { name: '지금 연결' }));

    await waitFor(() => {
      expect(linkDiscordMock).toHaveBeenCalledWith(7, 'oauth-code');
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['profile', 'account', 7] });
      expect(replace).toHaveBeenCalledWith('/ko/my');
    });
  });

  it('팝업 인증 중에 페이지를 떠나면 next 로 이동하지 않는다', async () => {
    let finishLink!: () => void;
    linkDiscordMock.mockImplementation(
      () =>
        new Promise<undefined>((resolve) => {
          finishLink = () => resolve(undefined);
        }),
    );

    const { OnboardingDiscord } = await import('./OnboardingDiscord');
    const user = userEvent.setup();
    const { unmount } = render(<OnboardingDiscord locale='ko' next='/ko/my' />);

    await screen.findByRole('button', { name: '지금 연결' });
    await user.click(screen.getByRole('button', { name: '지금 연결' }));
    await waitFor(() => expect(linkDiscordMock).toHaveBeenCalled());

    unmount();
    finishLink();

    await waitFor(() => expect(invalidateQueries).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalledWith('/ko/my');
  });
});
