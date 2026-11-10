import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./amplitude', () => ({ IS_PRODUCTION: true, COMMON_PROPS: { service: 'studyclub', env: 'production' } }));

let state: typeof import('./analytics-privacy-state');
let connect: typeof import('./clarity').connectClarity;
let disconnect: () => void;
const userA = `v1_${'a'.repeat(64)}`;
const userB = `v1_${'b'.repeat(64)}`;

// 외부 SDK의 공개 큐 계약: 태그는 start를 앞에 놓고, stop은 큐 함수를 다시 설치한다.
function finishLoading(identification?: Promise<void>) {
  const queued = [...(window.clarity?.q ?? [])];
  let active = false;
  const calls = vi.fn((method: string, ...args: unknown[]) => {
    if (method === 'start') active = true;
    if (method === 'stop') {
      active = false;
      const stub: NonNullable<Window['clarity']> = (name, ...values) => {
        (stub.q ??= []).push([name, ...values]);
      };
      window.clarity = stub;
    }
    if (method === 'metadata' && active) (args[0] as () => void)();
    if (method === 'identify') return identification;
  });
  window.clarity = Object.assign(calls, { v: 'test' });
  calls('start');
  for (const [method, ...args] of queued) calls(method as string, ...args);
  return calls;
}

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_CLARITY_PROJECT_ID', 'test-project');
  localStorage.clear();
  sessionStorage.clear();
  document.querySelector('#clarity-init')?.remove();
  delete window.clarity;
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false });
  state = await import('./analytics-privacy-state');
  connect = (await import('./clarity')).connectClarity;
  disconnect = connect();
});
afterEach(() => {
  disconnect();
  state.suspendAnalytics();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('Clarity 수집 중단', () => {
  it('허용 전에는 스크립트를 요청하지 않고, 허용 후 한 번만 로드하며 HMAC만 식별자로 쓴다', () => {
    expect(document.querySelector('#clarity-init')).toBeNull();
    state.allowAnalytics(userA);
    state.allowAnalytics(userA);
    expect(document.querySelectorAll('#clarity-init')).toHaveLength(1);
    const sdk = finishLoading();
    expect(sdk).toHaveBeenCalledWith('identify', userA);
    expect(sdk.mock.calls.filter(([method]) => method === 'identify')).toHaveLength(1);
    state.allowAnalytics(userA);
    expect(sdk.mock.calls.filter(([method]) => method === 'start')).toHaveLength(1);
  });

  it('로딩 중 거부하면 늦게 도착한 SDK도 중단하고 회원 식별자를 보내지 않는다', () => {
    state.allowAnalytics(userA);
    state.optOutAnalyticsLocally();
    const sdk = finishLoading();
    expect(sdk).toHaveBeenCalledWith('stop');
    expect(sdk.mock.calls.some(([method]) => method === 'identify')).toBe(false);
    state.allowAnalytics(userA);
    expect(sdk.mock.calls.filter(([method]) => method === 'start')).toHaveLength(1);
    expect(window.clarity?.q ?? []).toEqual([]);
  });

  it('중단 후 로그아웃·재연결에도 수집을 재개하지 않는다', () => {
    state.allowAnalytics(userA);
    const sdk = finishLoading();
    state.optOutAnalyticsLocally();
    disconnect();
    disconnect = connect();
    state.allowAnalytics(null);
    expect(sdk.mock.calls.filter(([method]) => method === 'stop')).toHaveLength(1);
    expect(sdk.mock.calls.filter(([method]) => method === 'start')).toHaveLength(1);
  });

  it('이전 방문의 거부가 저장되어 있으면 최초 로딩도 차단한다', () => {
    localStorage.setItem(state.ANALYTICS_OPTOUT_KEY, '1');
    state.allowAnalytics(null);
    expect(document.querySelector('#clarity-init')).toBeNull();
  });

  it('45초 허용 만료 시 중단하고 재확인 후 같은 HMAC을 다시 설정한다', () => {
    vi.useFakeTimers();
    state.allowAnalytics(userA);
    const sdk = finishLoading();
    vi.advanceTimersByTime(45_000);
    expect(sdk).toHaveBeenCalledWith('stop');
    state.allowAnalytics(userA);
    expect(sdk.mock.calls.filter(([method]) => method === 'start')).toHaveLength(2);
    expect(sdk.mock.calls.filter(([method]) => method === 'identify')).toEqual([
      ['identify', userA],
      ['identify', userA],
    ]);
  });

  it('계정 전환·로그아웃 시 이전 세션을 종료하고 브라우저 식별 쿠키를 정리한다', () => {
    state.allowAnalytics(userA);
    const sdk = finishLoading();
    document.cookie = '_clck=old-user; path=/';
    document.cookie = '_clsk=old-session; path=/';
    state.suspendAnalytics();
    state.allowAnalytics(userB);
    expect(document.cookie).not.toContain('_clck=');
    expect(document.cookie).not.toContain('_clsk=');
    expect(sdk).toHaveBeenCalledWith('identify', userB);
    state.suspendAnalytics();
    sdk.mockClear();
    state.allowAnalytics(null);
    expect(sdk).toHaveBeenCalledWith('start');
    expect(sdk.mock.calls.some(([method]) => method === 'identify')).toBe(false);
  });

  it('다른 계정으로 전환 중 로드가 끝나면 최신 허용 회원만 식별한다', () => {
    state.allowAnalytics(userA);
    state.suspendAnalytics();
    state.allowAnalytics(userB);
    const sdk = finishLoading();
    expect(sdk).toHaveBeenCalledWith('identify', userB);
    expect(sdk).not.toHaveBeenCalledWith('identify', userA);
  });

  it('GPC를 설정한 브라우저에서는 실행하지 않는다', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true });
    state.allowAnalytics(userA);
    expect(document.querySelector('#clarity-init')).toBeNull();
  });

  it('이전 회원의 비동기 식별이 끝나기 전에는 새 회원 세션을 시작하지 않는다', async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    state.allowAnalytics(userA);
    const sdk = finishLoading(pending);
    state.suspendAnalytics();
    state.allowAnalytics(userB);
    expect(sdk.mock.calls.filter(([method]) => method === 'start')).toHaveLength(1);
    expect(sdk).not.toHaveBeenCalledWith('identify', userB);
    finish();
    await pending;
    expect(sdk.mock.calls.filter(([method]) => method === 'start')).toHaveLength(2);
    expect(sdk).toHaveBeenCalledWith('identify', userB);
  });

  it('비동기 식별 완료를 기다리는 동안 거부하면 재개하지 않는다', async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    state.allowAnalytics(userA);
    const sdk = finishLoading(pending);
    state.suspendAnalytics();
    state.allowAnalytics(userB);
    state.optOutAnalyticsLocally();
    finish();
    await pending;
    expect(sdk.mock.calls.filter(([method]) => method === 'start')).toHaveLength(1);
    expect(sdk).not.toHaveBeenCalledWith('identify', userB);
  });

  it('쿠키 접근이 차단되어도 SDK 중단과 다른 구독자의 처리를 수행한다', () => {
    state.allowAnalytics(userA);
    const sdk = finishLoading();
    const other = vi.fn();
    const unsubscribe = state.subscribeAnalytics(other);
    const cookie = vi.spyOn(document, 'cookie', 'set').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      expect(() => state.optOutAnalyticsLocally()).not.toThrow();
      expect(sdk).toHaveBeenCalledWith('stop');
      expect(other).toHaveBeenCalled();
    } finally {
      cookie.mockRestore();
      unsubscribe();
    }
  });

  it('연결 해제 중 로드가 끝나도 수집을 중단하고 식별하지 않는다', () => {
    state.allowAnalytics(userA);
    disconnect();
    const sdk = finishLoading();
    expect(sdk).toHaveBeenCalledWith('stop');
    expect(sdk.mock.calls.some(([method]) => method === 'identify')).toBe(false);
  });

  it('로딩 오류 시 스크립트를 중복 삽입하지 않는다', () => {
    state.allowAnalytics(userA);
    document.querySelector('#clarity-init')!.dispatchEvent(new Event('error'));
    state.allowAnalytics(userA);
    expect(document.querySelectorAll('#clarity-init')).toHaveLength(1);
  });
});
