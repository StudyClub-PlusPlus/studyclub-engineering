// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
const invalidateQueries = vi.fn(async () => undefined);
const linkDiscord = vi.fn(async () => undefined);
const requestDiscordCode = vi.fn(async () => 'oauth-code');
const fetchDiscordLinkState = vi.fn(async () => 'unlinked' as const);

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
  fetchDiscordLinkState: (...args: unknown[]) => fetchDiscordLinkState(...args),
  linkDiscord: (...args: unknown[]) => linkDiscord(...args),
  requestDiscordCode: (...args: unknown[]) => requestDiscordCode(...args),
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
    linkDiscord.mockClear();
    requestDiscordCode.mockClear();
    fetchDiscordLinkState.mockReset();
    fetchDiscordLinkState.mockResolvedValue('unlinked');
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
      expect(linkDiscord).toHaveBeenCalledWith(7, 'oauth-code');
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['profile', 'account', 7] });
      expect(replace).toHaveBeenCalledWith('/ko/my');
    });
  });

  it('팝업 인증 중에 페이지를 떠나면 next 로 이동하지 않는다', async () => {
    let finishLink!: () => void;
    linkDiscord.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishLink = resolve;
        }),
    );

    const { OnboardingDiscord } = await import('./OnboardingDiscord');
    const user = userEvent.setup();
    const { unmount } = render(<OnboardingDiscord locale='ko' next='/ko/my' />);

    await screen.findByRole('button', { name: '지금 연결' });
    await user.click(screen.getByRole('button', { name: '지금 연결' }));
    await waitFor(() => expect(linkDiscord).toHaveBeenCalled());

    unmount();
    finishLink();

    await waitFor(() => expect(invalidateQueries).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalledWith('/ko/my');
  });
});
