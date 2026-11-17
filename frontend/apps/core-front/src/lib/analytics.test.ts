import { beforeEach, describe, expect, it } from 'vitest';

import { captureFirstTouch, readGaClientId } from './analytics';
import { allowAnalytics, suspendAnalytics } from './analytics-privacy-state';

// 첫 유입은 가입 때 setOnce 로 한 번만 붙는다. 두 번째 방문이 덮어쓰면 광고 성과가 엉뚱한 채널로 간다.
describe('captureFirstTouch', () => {
  beforeEach(() => {
    localStorage.clear();
    allowAnalytics(null);
  });

  it('utm 을 소문자로, 랜딩 경로와 함께 저장하고 다음 방문이 덮지 않는다', () => {
    window.history.replaceState(null, '', '/ko/studies?utm_source=Instagram&utm_medium=paid_social');
    captureFirstTouch();
    window.history.replaceState(null, '', '/ko?utm_source=newsletter');
    captureFirstTouch();

    expect(JSON.parse(localStorage.getItem('sc_first_touch') ?? '{}')).toEqual({
      acquisition_landing_path: '/ko/studies',
      acquisition_source: 'instagram',
      acquisition_medium: 'paid_social',
    });
  });
});

describe('readGaClientId', () => {
  beforeEach(() => {
    localStorage.clear();
    allowAnalytics(null);
  });
  it('_ga 쿠키에서 client_id 만 꺼내고, 없으면 undefined', () => {
    expect(readGaClientId('a=1; _ga=GA1.1.123456789.1700000000; b=2')).toBe('123456789.1700000000');
    expect(readGaClientId('_gat=1')).toBeUndefined();
  });
});

it('중단 상태에서는 첫 유입과 GA 식별자를 수집하지 않는다', () => {
  localStorage.clear();
  suspendAnalytics();
  captureFirstTouch();
  expect(localStorage.getItem('sc_first_touch')).toBeNull();
  expect(readGaClientId('_ga=GA1.1.123.456')).toBeUndefined();
});
