import type { Study } from '@studyclub/mock';
import { describe, expect, it } from 'vitest';

import { studyTimezone, studyTimezoneLabel } from './recruit';

const base: Study = {
  id: '1',
  study_id: 1,
  title: { ko: '스터디', en: 'Study' },
  summary: { ko: '소개', en: 'Summary' },
  status: 'recruiting',
  format: 'online',
};

describe('studyTimezone', () => {
  it('운영자가 고른 값이 일정 문구보다 앞선다 — BOTH 는 동시 진행', () => {
    const study = { ...base, timezone: 'both' as const, schedule: { ko: '매주 화 21:00 KST', en: 'Tue 21:00 KST' } };
    expect(studyTimezone(study)).toBe('both');
    expect(studyTimezoneLabel(study, 'ko')).toBe('동시 진행(KST·PST)');
    expect(studyTimezoneLabel(study, 'en')).toBe('Multiple timezones (KST·PST)');
  });

  it('고른 값이 없으면 일정 문구로 추정한다', () => {
    expect(studyTimezone({ ...base, schedule: { ko: '매주 수 19:00 PDT', en: '' } })).toBe('PST');
    expect(studyTimezone({ ...base, schedule: { ko: '매주 화 21:00 KST', en: '' } })).toBe('KST');
  });

  it('표기조차 없으면 동시 진행이라 단정하지 않고 시간대 미정', () => {
    expect(studyTimezone(base)).toBeUndefined();
    expect(studyTimezoneLabel(base, 'ko')).toBe('시간대 미정');
  });
});
