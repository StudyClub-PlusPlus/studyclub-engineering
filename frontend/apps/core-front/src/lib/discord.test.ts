import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// client id 는 모듈을 읽을 때 정해진다 — 넣은 뒤에 불러온다
async function load() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_DISCORD_CLIENT_ID', 'test-client');
  return import('./discord');
}

function post(data: unknown, origin = window.location.origin) {
  window.dispatchEvent(new MessageEvent('message', { data, origin }));
}

describe('requestDiscordCode', () => {
  let popup: { closed: boolean; close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    popup = { closed: false, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('이번 state 가 실린 같은 출처 메시지에서만 code 를 받는다', async () => {
    const { requestDiscordCode, DISCORD_OAUTH_SOURCE, DISCORD_CALLBACK_PATH } = await load();
    const result = requestDiscordCode();

    const url = new URL(vi.mocked(window.open).mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(url.searchParams.get('redirect_uri')).toBe(window.location.origin + DISCORD_CALLBACK_PATH);
    expect(url.searchParams.get('scope')).toBe('identify guilds.members.read');
    const state = url.searchParams.get('state');

    post({ source: DISCORD_OAUTH_SOURCE, code: 'forged', state: 'other' });
    post({ source: DISCORD_OAUTH_SOURCE, code: 'forged', state }, 'https://evil.example');
    post({ source: DISCORD_OAUTH_SOURCE, code: 'real', state });

    await expect(result).resolves.toBe('real');
    expect(popup.close).toHaveBeenCalled();
  });

  it('디스코드에서 취소하면 cancelled', async () => {
    const { requestDiscordCode, DISCORD_OAUTH_SOURCE } = await load();
    const result = requestDiscordCode();
    const state = new URL(vi.mocked(window.open).mock.calls[0][0] as string).searchParams.get('state');

    post({ source: DISCORD_OAUTH_SOURCE, code: '', state, error: 'access_denied' });

    await expect(result).rejects.toMatchObject({ reason: 'cancelled' });
  });

  it('팝업이 차단되면 blocked', async () => {
    vi.mocked(window.open).mockReturnValue(null);
    const { requestDiscordCode } = await load();

    await expect(requestDiscordCode()).rejects.toMatchObject({ reason: 'blocked' });
  });

  it('창을 그냥 닫으면 cancelled', async () => {
    vi.useFakeTimers();
    const { requestDiscordCode } = await load();
    const result = requestDiscordCode();

    popup.closed = true;
    vi.advanceTimersByTime(500);

    await expect(result).rejects.toMatchObject({ reason: 'cancelled' });
  });
});
