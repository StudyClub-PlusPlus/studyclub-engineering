import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-TEST';
});
const mocks = vi.hoisted(() => ({
  user: { id: 42 } as { id: number } | null,
  load: vi.fn(),
  register: vi.fn(),
  init: vi.fn(),
  setOptOut: vi.fn(),
  setUserId: vi.fn(),
  reset: vi.fn(),
  flush: vi.fn(),
}));
vi.mock('@/features/auth/auth', () => ({ getUser: () => mocks.user, USER_CHANGED_EVENT: 'test-user-changed' }));
vi.mock('@/features/analytics/repository', () => ({
  loadAnalyticsSettings: mocks.load,
  registerAnalyticsBrowser: mocks.register,
}));
vi.mock('@/lib/amplitude', () => ({
  IS_PRODUCTION: true,
  analyticsEnabled: true,
  initAmplitude: mocks.init,
  amplitude: { setOptOut: mocks.setOptOut, setUserId: mocks.setUserId, reset: mocks.reset, flush: mocks.flush },
}));
vi.mock('@/lib/analytics', () => ({
  captureFirstTouch: vi.fn(),
  clearFirstTouch: vi.fn(),
  syncAnalyticsUser: vi.fn(),
}));
import { AnalyticsPrivacy } from './AnalyticsPrivacy';
import {
  analyticsAllowed,
  analyticsUserId,
  hasLocalAnalyticsOptOut,
  suspendAnalytics,
} from '@/lib/analytics-privacy-state';
import { ApiError } from '@/lib/http';

describe('서버 상태를 따르는 브라우저 분석', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    suspendAnalytics();
    mocks.user = { id: 42 };
    mocks.init.mockResolvedValue(undefined);
    mocks.flush.mockResolvedValue(undefined);
    mocks.load.mockResolvedValue({ userId: 'v1_protected', enabled: true, optedOutAt: null });
    mocks.register.mockResolvedValue({ userId: 'v1_protected', enabled: true, optedOutAt: null });
  });
  afterEach(() => {
    cleanup();
    suspendAnalytics();
  });
  it('허용 상태 응답 전에는 초기화하지 않고 회원번호 대신 서버 분석 ID를 쓴다', async () => {
    let resolve!: (v: unknown) => void;
    mocks.load.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    render(<AnalyticsPrivacy />);
    expect(analyticsAllowed()).toBe(false);
    expect(mocks.init).not.toHaveBeenCalled();
    await act(async () => resolve({ userId: 'v1_protected', enabled: true, optedOutAt: null }));
    await waitFor(() => expect(mocks.setUserId).toHaveBeenCalledWith('v1_protected'));
    expect(analyticsAllowed()).toBe(true);
    expect(mocks.setUserId).not.toHaveBeenCalledWith('42');
  });
  it('조회 실패하면 SDK를 켜지 않는다', async () => {
    mocks.load.mockRejectedValue(new Error('offline'));
    render(<AnalyticsPrivacy />);
    await waitFor(() => expect(mocks.load).toHaveBeenCalled());
    expect(analyticsAllowed()).toBe(false);
    expect(mocks.init).not.toHaveBeenCalled();
  });
  it('인증 만료는 영구 거부로 저장하지 않고 재로그인 후 허용 상태를 다시 조회한다', async () => {
    mocks.load.mockRejectedValueOnce(new ApiError(401, '로그인 만료'));
    render(<AnalyticsPrivacy />);
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(1));
    expect(analyticsAllowed()).toBe(false);
    expect(hasLocalAnalyticsOptOut()).toBe(false);
    expect(mocks.init).not.toHaveBeenCalled();
    act(() => window.dispatchEvent(new Event('test-user-changed')));
    await waitFor(() => expect(analyticsAllowed()).toBe(true));
    expect(mocks.load).toHaveBeenCalledTimes(2);
    expect(hasLocalAnalyticsOptOut()).toBe(false);
  });
  it('재로그인 후 서버가 실제 중단 상태를 반환하면 계속 수집하지 않는다', async () => {
    mocks.load.mockRejectedValueOnce(new ApiError(401, '로그인 만료'));
    render(<AnalyticsPrivacy />);
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(1));
    mocks.load.mockResolvedValue({ userId: null, enabled: false, optedOutAt: '2026-11-08T00:00:00Z' });
    act(() => window.dispatchEvent(new Event('test-user-changed')));
    await waitFor(() => expect(hasLocalAnalyticsOptOut()).toBe(true));
    expect(analyticsAllowed()).toBe(false);
    expect(mocks.init).not.toHaveBeenCalled();
  });
  it('회원이 삭제된 응답은 브라우저 중단 상태로 유지한다', async () => {
    mocks.load.mockRejectedValueOnce(new ApiError(404, '회원 없음'));
    render(<AnalyticsPrivacy />);
    await waitFor(() => expect(hasLocalAnalyticsOptOut()).toBe(true));
    act(() => window.dispatchEvent(new Event('test-user-changed')));
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(analyticsAllowed()).toBe(false);
  });
  it('문의 처리 후 상태 갱신으로 중단하며 로그아웃해도 재개하지 않는다', async () => {
    render(<AnalyticsPrivacy />);
    await waitFor(() => expect(analyticsAllowed()).toBe(true));
    mocks.load.mockResolvedValue({ userId: null, enabled: false, optedOutAt: '2026-11-08T00:00:00Z' });
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(hasLocalAnalyticsOptOut()).toBe(true));
    mocks.user = null;
    act(() => window.dispatchEvent(new Event('test-user-changed')));
    expect(analyticsAllowed()).toBe(false);
    expect(mocks.setOptOut).toHaveBeenLastCalledWith(true);
    const previousRequests = mocks.load.mock.calls.length;
    mocks.user = { id: 42 };
    act(() => window.dispatchEvent(new Event('test-user-changed')));
    expect(mocks.load).toHaveBeenCalledTimes(previousRequests);
    expect(analyticsAllowed()).toBe(false);
  });
  it('늦게 돌아온 이전 계정의 허용 응답으로 새 계정의 중단을 덮지 않는다', async () => {
    let resolve!: (v: unknown) => void;
    mocks.load.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    render(<AnalyticsPrivacy />);
    mocks.user = { id: 43 };
    mocks.load.mockResolvedValue({ userId: null, enabled: false, optedOutAt: '2026-11-08T00:00:00Z' });
    act(() => window.dispatchEvent(new Event('test-user-changed')));
    await waitFor(() => expect(hasLocalAnalyticsOptOut()).toBe(true));
    await act(async () => resolve({ userId: 'old-account', enabled: true, optedOutAt: null }));
    expect(analyticsAllowed()).toBe(false);
    expect(analyticsUserId()).not.toBe('old-account');
    expect(mocks.init).not.toHaveBeenCalled();
  });
  it('GA client ID를 서버에 저장할 수 없으면 두 분석 도구 모두 시작하지 않는다', async () => {
    mocks.register.mockRejectedValue(new Error('offline'));
    render(<AnalyticsPrivacy />);
    await waitFor(() => expect(mocks.register).toHaveBeenCalled());
    expect(analyticsAllowed()).toBe(false);
    expect(mocks.init).not.toHaveBeenCalled();
  });
  it('SDK의 중단 장치 초기화가 끝나기 전에는 페이지 수집을 허용하지 않는다', async () => {
    let ready!: () => void;
    mocks.init.mockImplementationOnce(
      () =>
        new Promise<void>((r) => {
          ready = r;
        }),
    );
    render(<AnalyticsPrivacy />);
    await waitFor(() => expect(mocks.init).toHaveBeenCalled());
    expect(analyticsAllowed()).toBe(false);
    await act(async () => ready());
    expect(analyticsAllowed()).toBe(true);
  });
});
