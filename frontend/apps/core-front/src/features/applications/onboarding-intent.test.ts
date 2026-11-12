import { describe, expect, it } from 'vitest';

import { shouldWaitForMyApplication } from './intent-resume';
import { withApplyIntent, withoutApplyIntent } from '@/features/onboarding/model';

describe('apply intent helpers', () => {
  it('신청 의도를 붙이고 다시 지운다', () => {
    expect(withApplyIntent('/ko/studies/12')).toBe('/ko/studies/12?apply=1');
    expect(withApplyIntent('/ko/studies/12?tab=info')).toBe('/ko/studies/12?tab=info&apply=1');
    expect(withoutApplyIntent('/ko/studies/12?apply=1')).toBe('/ko/studies/12');
    expect(withoutApplyIntent('/ko/studies/12?tab=info&apply=1')).toBe('/ko/studies/12?tab=info');
  });

  it('해시와 다른 쿼리는 남긴다', () => {
    expect(withoutApplyIntent('/en/studies/3?apply=1#top')).toBe('/en/studies/3#top');
    expect(withApplyIntent('/en/studies/3#top')).toBe('/en/studies/3?apply=1#top');
  });
});

describe('shouldWaitForMyApplication', () => {
  it('로그인 사용자는 내 신청 조회가 끝날 때까지 기다린다', () => {
    expect(shouldWaitForMyApplication(true, false)).toBe(true);
    expect(shouldWaitForMyApplication(true, true)).toBe(false);
  });

  it('비로그인은 조회 없이 바로 진행한다', () => {
    expect(shouldWaitForMyApplication(false, false)).toBe(false);
    expect(shouldWaitForMyApplication(false, true)).toBe(false);
  });
});
