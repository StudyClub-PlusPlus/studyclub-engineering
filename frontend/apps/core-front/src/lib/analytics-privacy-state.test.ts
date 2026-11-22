import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  afterAnalyticsReady,
  allowAnalytics,
  analyticsAllowed,
  analyticsClientId,
  hasLocalAnalyticsOptOut,
  optOutAnalyticsLocally,
  ownedGaClientId,
  subscribeAnalytics,
  suspendAnalytics,
} from './analytics-privacy-state';

describe('분석 허용 상태', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    suspendAnalytics();
  });
  afterEach(() => {
    suspendAnalytics();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  it('기본은 차단이며 45초 동안 갱신되지 않으면 GA와 SDK 구독자 모두 차단한다', () => {
    vi.stubEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID', 'G-TEST');
    expect(analyticsAllowed()).toBe(false);
    const listener = vi.fn();
    const off = subscribeAnalytics(listener);
    allowAnalytics('protected-id', '123.456');
    expect(analyticsAllowed()).toBe(true);
    expect(analyticsClientId()).toBe('123.456');
    vi.advanceTimersByTime(45_000);
    expect(analyticsAllowed()).toBe(false);
    expect((window as unknown as Record<string, unknown>)['ga-disable-G-TEST']).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);
    off();
  });
  it('중단은 로그아웃·다른 계정 허용 시도 뒤에도 이 브라우저에 남는다', () => {
    allowAnalytics('member-a');
    optOutAnalyticsLocally();
    allowAnalytics(null);
    allowAnalytics('member-b');
    expect(hasLocalAnalyticsOptOut()).toBe(true);
    expect(analyticsAllowed()).toBe(false);
  });
  it('같은 계정의 브라우저 ID는 재사용하고 로그인·로그아웃·계정 전환 때 회전한다', () => {
    const anonymous = ownedGaClientId(null),
      first = ownedGaClientId('first');
    expect(first).toMatch(/^\d+\.\d+$/);
    expect(ownedGaClientId('first')).toBe(first);
    const second = ownedGaClientId('second');
    expect(second).not.toBe(first);
    expect(first).not.toBe(anonymous);
    expect(ownedGaClientId(null)).not.toBe(second);
  });
  it('저장소를 읽을 수 없으면 원문 ID나 임의 허용으로 우회하지 않는다', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    allowAnalytics('protected-id');
    expect(analyticsAllowed()).toBe(false);
  });
  it('가입·로그인 이벤트는 같은 계정 허용 때만 보내며 거부·계정 전환 때 버린다', async () => {
    let account = 1;
    const sent = vi.fn();
    afterAnalyticsReady(() => account === 1, sent);
    expect(sent).not.toHaveBeenCalled();
    allowAnalytics('id-1');
    await vi.runAllTicks();
    expect(sent).toHaveBeenCalledTimes(1);
    suspendAnalytics();
    afterAnalyticsReady(() => account === 1, sent);
    account = 2;
    allowAnalytics('id-2');
    await vi.runAllTicks();
    expect(sent).toHaveBeenCalledTimes(1);
    suspendAnalytics();
    afterAnalyticsReady(() => true, sent);
    optOutAnalyticsLocally();
    allowAnalytics('id-2');
    await vi.runAllTicks();
    expect(sent).toHaveBeenCalledTimes(1);
  });
  it('Google 스크립트가 아직 읽지 않은 대기 이벤트는 중단할 때 버린다', () => {
    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = [
      ['config', 'G-TEST', { user_id: 'old' }],
      ['event', 'page_view'],
    ];
    suspendAnalytics();
    expect(w.dataLayer).toEqual([]);
  });
  it('SDK 준비가 늦어져도 서버 상태의 유효기간을 늘리지 않는다', () => {
    const checkedAt = Date.now();
    vi.advanceTimersByTime(35_000);
    allowAnalytics('protected-id', undefined, checkedAt);
    expect(analyticsAllowed()).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(analyticsAllowed()).toBe(false);
  });
  it('거부 상태 저장에 실패해도 현재 페이지에서 수집을 재개하지 않는다', async () => {
    vi.resetModules();
    const state = await import('./analytics-privacy-state');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    state.optOutAnalyticsLocally();
    state.allowAnalytics('protected-id');
    expect(state.analyticsAllowed()).toBe(false);
    state.suspendAnalytics();
  });
});
