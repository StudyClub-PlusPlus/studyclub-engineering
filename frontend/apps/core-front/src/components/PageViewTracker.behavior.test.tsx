import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ pathname: '/ko/studies/12', track: vi.fn(), identify: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useParams: () => ({ locale: 'ko' }),
}));
vi.mock('@/lib/analytics', () => ({ track: mocks.track, identifyUser: mocks.identify }));

import { PageViewTracker } from './PageViewTracker';
import { allowAnalytics, suspendAnalytics } from '@/lib/analytics-privacy-state';

const finishPageView = () => act(() => vi.advanceTimersByTime(600));

describe('분석 허용과 페이지 방문 집계', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
    suspendAnalytics();
    mocks.pathname = '/ko/studies/12';
  });
  afterEach(() => {
    cleanup();
    suspendAnalytics();
    vi.useRealTimers();
  });

  it('최초 허용까지 기다리고 탭 복귀나 허용 만료 뒤 재개해도 같은 방문을 중복 집계하지 않는다', () => {
    render(<PageViewTracker />);
    finishPageView();
    expect(mocks.track).not.toHaveBeenCalled();
    act(() => allowAnalytics('member'));
    finishPageView();
    expect(mocks.track).toHaveBeenCalledTimes(1);
    act(() => suspendAnalytics());
    act(() => allowAnalytics('member'));
    finishPageView();
    act(() => vi.advanceTimersByTime(45_000));
    act(() => allowAnalytics('member'));
    finishPageView();
    expect(mocks.track).toHaveBeenCalledTimes(1);
  });

  it('전송 전에 잠시 중단되면 복귀한 뒤 최초 조회를 빠뜨리지 않는다', () => {
    act(() => allowAnalytics('member'));
    render(<PageViewTracker />);
    act(() => vi.advanceTimersByTime(100));
    act(() => suspendAnalytics());
    finishPageView();
    expect(mocks.track).not.toHaveBeenCalled();
    act(() => allowAnalytics('member'));
    finishPageView();
    expect(mocks.track).toHaveBeenCalledTimes(1);
  });

  it('다른 경로를 방문하고 돌아오거나 새로 마운트되면 새 방문을 집계한다', () => {
    act(() => allowAnalytics('member'));
    const page = render(<PageViewTracker />);
    finishPageView();
    mocks.pathname = '/ko/about';
    page.rerender(<PageViewTracker />);
    finishPageView();
    mocks.pathname = '/ko/studies/12';
    page.rerender(<PageViewTracker />);
    finishPageView();
    expect(mocks.track).toHaveBeenCalledTimes(3);
    page.unmount();
    render(<PageViewTracker />);
    finishPageView();
    expect(mocks.track).toHaveBeenCalledTimes(4);
  });

  it('중단 중 다른 경로를 거쳐 돌아온 방문도 허용 뒤 한 번 집계한다', () => {
    act(() => allowAnalytics('member'));
    const page = render(<PageViewTracker />);
    finishPageView();
    act(() => suspendAnalytics());
    mocks.pathname = '/ko/about';
    page.rerender(<PageViewTracker />);
    mocks.pathname = '/ko/studies/12';
    page.rerender(<PageViewTracker />);
    finishPageView();
    expect(mocks.track).toHaveBeenCalledTimes(1);
    act(() => allowAnalytics('member'));
    finishPageView();
    expect(mocks.track).toHaveBeenCalledTimes(2);
  });
});
