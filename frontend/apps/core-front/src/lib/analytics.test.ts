import { beforeEach, describe, expect, it } from 'vitest';

import { captureFirstTouch, readGaClientId } from './analytics';

// 첫 유입은 가입 때 setOnce 로 한 번만 붙는다. 두 번째 방문이 덮어쓰면 광고 성과가 엉뚱한 채널로 간다.
describe('captureFirstTouch', () => {
  beforeEach(() => localStorage.clear());

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
  it('_ga 쿠키에서 client_id 만 꺼내고, 없으면 undefined', () => {
    expect(readGaClientId('a=1; _ga=GA1.1.123456789.1700000000; b=2')).toBe('123456789.1700000000');
    expect(readGaClientId('_gat=1')).toBeUndefined();
  });
});
