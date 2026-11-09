import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Guard = {
  name: string;
  setup: (config: { transportProvider: { send: ReturnType<typeof vi.fn> } }) => Promise<void>;
  execute: (event: unknown) => Promise<unknown>;
};
const mock = vi.hoisted(() => ({ plugins: [] as Guard[], init: vi.fn() }));
vi.mock('@amplitude/analytics-browser', () => ({
  add: (plugin: Guard) => {
    mock.plugins.push(plugin);
    return { promise: Promise.resolve() };
  },
  init: mock.init,
}));

describe('Amplitude 전송 직전 차단', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_AMPLITUDE_API_KEY', 'test-public-key');
    localStorage.clear();
    mock.plugins.length = 0;
    mock.init.mockReturnValue({ promise: Promise.resolve() });
  });
  afterEach(() => vi.unstubAllEnvs());
  it('큐에 있던 이벤트도 중단 뒤에는 보내지 않고 다른 계정의 지연 이벤트를 버린다', async () => {
    const sdk = await import('./amplitude');
    const state = await import('./analytics-privacy-state');
    await sdk.initAmplitude('member-a');
    const guard = mock.plugins.find((p) => p.name === 'privacy-transport')!;
    const send = vi.fn().mockResolvedValue({ status: 'success' });
    const config = { transportProvider: { send } };
    await guard.setup(config);
    state.allowAnalytics('member-a');
    const event = { event_type: 'Page Viewed', user_id: 'member-a' };
    await config.transportProvider.send('test-endpoint', { events: [event] });
    expect(send).toHaveBeenCalledTimes(1);
    state.suspendAnalytics();
    expect(await guard.execute(event)).toBeNull();
    await config.transportProvider.send('test-endpoint', { events: [event] });
    expect(send).toHaveBeenCalledTimes(1);
    state.allowAnalytics('member-b');
    await config.transportProvider.send('test-endpoint', { events: [event] });
    expect(send).toHaveBeenCalledTimes(1);
    await config.transportProvider.send('test-endpoint', { events: [{ ...event, user_id: 'member-b' }] });
    expect(send).toHaveBeenCalledTimes(2);
    state.suspendAnalytics();
    expect(mock.init).toHaveBeenCalledWith('test-public-key', 'member-a', expect.objectContaining({ optOut: true }));
  });
});
