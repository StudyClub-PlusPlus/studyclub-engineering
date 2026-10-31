import type { Study } from '@studyclub/types';
import { describe, expect, it } from 'vitest';

import { recruitBadge, recruitState, studyStartValue, studyTimezone, studyTimezoneLabel } from './recruit';

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

// 백오피스는 시작일을 서울 00:00, 마감일을 서울 23:59:59 로 저장한다
describe('서울 날짜로 읽는다', () => {
  it('시작 예정일 — 서울 10월 15일 00:00(UTC 10월 14일 15:00)은 10월 15일이다', () => {
    expect(studyStartValue({ ...base, startAt: '2026-10-14T15:00:00Z' }, 'ko')).toBe('2026-10-15');
  });

  it('시작 예정일 — 날짜만 있으면 그대로, 없으면 미정', () => {
    expect(studyStartValue({ ...base, startAt: '2026-10-15' }, 'ko')).toBe('2026-10-15');
    expect(studyStartValue(base, 'ko')).toBe('미정');
  });

  const due = { ...base, recruitment: { status: 'open' as const, deadline: '2026-11-05' } };

  it('D-N — 서울 11월 2일 오전 8시(UTC 11월 1일)에도 D-3 이다', () => {
    const seoulMorning = new Date('2026-11-01T23:00:00Z');
    expect(recruitBadge(due, 'ko', seoulMorning).label).toBe('모집중 (D-3)');
  });

  it('마감 — 서울 11월 6일 오전 1시(UTC 11월 5일)면 마감이다', () => {
    const afterDeadline = new Date('2026-11-05T16:00:00Z');
    expect(recruitState(due, afterDeadline)).toBe('closed');
    expect(recruitState(due, new Date('2026-11-05T14:00:00Z'))).toBe('apply');
  });
});
