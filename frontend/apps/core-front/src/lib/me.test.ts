import { describe, expect, it } from 'vitest';

import { regionOfTimeZone } from './me';

// 신청 폼은 "가능한 시간" 을 이 지역의 현지 시간으로 받는다. 지역이 틀리면 운영자가 겹치는 시간을
// 잘못 계산하는데, 화면에는 아무 표시가 안 난다.
describe('regionOfTimeZone', () => {
  it('서울이면 한국', () => {
    expect(regionOfTimeZone('Asia/Seoul')).toBe('KR');
  });

  it('그 밖의 시간대는 북미', () => {
    expect(regionOfTimeZone('America/New_York')).toBe('NA');
    expect(regionOfTimeZone('America/Vancouver')).toBe('NA');
    expect(regionOfTimeZone('America/Los_Angeles')).toBe('NA');
  });

  it('시간대가 아직 없으면 한국으로 본다', () => {
    expect(regionOfTimeZone(null)).toBe('KR');
    expect(regionOfTimeZone(undefined)).toBe('KR');
  });
});
