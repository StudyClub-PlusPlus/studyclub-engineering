import { describe, expect, it } from 'vitest';

import { studyQuery, toStudy, toStudyFromDetail } from './model';

const apiStudy = {
  studyId: 7,
  title: '데일리 리트코드',
  oneLineSummary: '매일 알고리즘 문제 풀이',
  category: 'ALGORITHM',
  studyKind: 'STUDY' as const,
  thumbnailUrl: null,
  schedule: '매주 화 21:00 KST',
  timezone: 'KST' as const,
  status: 'OPEN' as const,
  phase: 'RECRUITING' as const,
  recruitStatus: 'RECRUITING' as const,
  capacity: 30,
  currentApplicants: 12,
  // 백오피스가 저장하는 값 — 서울 9월 30일 23:59:59. 화면은 서울 날짜로 읽는다 (@studyclub/utils)
  recruitDeadlineAt: '2026-09-30T14:59:59Z',
  startAt: '2026-10-01T00:00:00Z',
  endAt: null,
  closingSoon: false,
};

describe('studyQuery', () => {
  it('화면 조건을 백엔드 enum 쿼리로 올리고, 빈 조건은 보내지 않는다', () => {
    const q = studyQuery({
      keyword: '  리트코드 ',
      status: 'recruiting',
      timezone: 'both',
      category: 'ALGORITHM',
    });
    expect(Object.fromEntries(q)).toEqual({
      limit: '100',
      keyword: '리트코드',
      status: 'RECRUITING',
      timezone: 'BOTH',
      category: 'ALGORITHM',
    });
    expect(Object.fromEntries(studyQuery({ keyword: ' ' }))).toEqual({ limit: '100' });
  });
});

describe('toStudy', () => {
  it('카테고리는 표시 이름으로, 단계는 화면 상태로 바꾼다', () => {
    const s = toStudy(apiStudy);
    expect(s.category).toBe('알고리즘');
    expect(s.status).toBe('recruiting');
    expect(s.summary.ko).toBe('매일 알고리즘 문제 풀이');
    expect(s.recruitment).toEqual({ status: 'open', deadline: '2026-09-30' });
  });

  it('마감 없이 모집 중이면 상시 모집, 모집이 닫혔으면 closed', () => {
    expect(toStudy({ ...apiStudy, recruitDeadlineAt: null }).recruitment?.status).toBe('always');
    expect(toStudy({ ...apiStudy, recruitStatus: 'RECRUIT_CLOSED' }).recruitment?.status).toBe('closed');
  });
});

describe('시간대', () => {
  it('운영자가 고른 값을 싣는다 — BOTH 는 both, null 은 비운다', () => {
    expect(toStudy(apiStudy).timezone).toBe('KST');
    expect(toStudy({ ...apiStudy, timezone: 'BOTH' }).timezone).toBe('both');
    expect(toStudy({ ...apiStudy, timezone: null }).timezone).toBeUndefined();
  });

  it('상세도 같은 값을 싣는다', () => {
    const detail = {
      id: 7,
      programId: 3,
      title: '데일리 리트코드',
      oneLineSummary: '매일 알고리즘 문제 풀이',
      description: null,
      category: 'ALGORITHM',
      studyKind: 'STUDY' as const,
      thumbnailUrl: null,
      status: 'OPEN' as const,
      recruitStatus: 'RECRUITING' as const,
      curriculum: null,
      capacity: 30,
      recruitDeadlineAt: null,
      schedule: null,
      timezone: 'PST' as const,
      startAt: null,
      endAt: null,
      discordChannelUrl: null,
      driveUrl: null,
      programTitle: '테스트 프로그램',
      discordLinked: false,
    };
    expect(toStudyFromDetail(detail).timezone).toBe('PST');
    expect(toStudyFromDetail({ ...detail, timezone: null }).timezone).toBeUndefined();
  });
});
