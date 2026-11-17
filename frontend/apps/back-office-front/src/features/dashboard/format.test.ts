import { describe, expect, it } from 'vitest';

import {
  categoryLabel,
  deadlineLabel,
  formatAsOf,
  formatCount,
  formatDelta,
  formatPerCrew,
  formatRate,
} from '@/features/dashboard/format';

// spec 4.3 예시와 같은 기준 시각 — 뉴욕은 아직 15일 밤, 서울은 16일 낮이다
const AS_OF = '2026-09-16T03:00:00Z';

describe('숫자 (spec 2.4)', () => {
  it('인원은 천 단위, 출석률은 정수 %, 1인당은 소수 한 자리', () => {
    expect(formatCount(1462)).toBe('1,462');
    expect(formatRate(78.43)).toBe('78%');
    expect(formatRate(78.5)).toBe('79%');
    expect(formatPerCrew(173 / 128)).toBe('1.4개');
    expect(formatPerCrew(2)).toBe('2.0개');
  });

  it('전주 대비는 필요할 때만 소수 한 자리, 반올림해 0 이면 중립 –0%p', () => {
    expect(formatDelta(-6.75)).toEqual({ text: '▼6.8%p', tone: 'down' });
    expect(formatDelta(3)).toEqual({ text: '▲3%p', tone: 'up' });
    expect(formatDelta(0)).toEqual({ text: '–0%p', tone: 'flat' });
    expect(formatDelta(-0.04)).toEqual({ text: '–0%p', tone: 'flat' });
  });
});

describe('갱신 시각 (1-1)', () => {
  it('응답 시간대로 바꾸고 그날의 약칭을 붙인다 — 24시간제', () => {
    expect(formatAsOf(AS_OF, 'America/New_York')).toBe('2026-09-15 23:00 EDT');
    expect(formatAsOf('2026-12-16T03:00:00Z', 'America/New_York')).toBe('2026-12-15 22:00 EST');
    expect(formatAsOf(AS_OF, 'Asia/Seoul')).toBe('2026-09-16 12:00 KST');
    expect(formatAsOf(AS_OF, 'UTC')).toBe('2026-09-16 03:00 UTC');
  });

  it('브라우저가 모르는 시간대면 UTC 로 그린다', () => {
    expect(formatAsOf(AS_OF, 'Mars/Olympus')).toBe('2026-09-16 03:00 UTC');
  });
});

describe('모집 마감 칸 (3-2) — 서버 표시 코드로 고르고, 임박·오늘 마감은 쓰지 않는다', () => {
  const deadline = '2026-09-18T14:59:00Z';

  it('D-N 은 응답 시간대의 달력 날짜 차이다', () => {
    // 뉴욕: 15일 → 18일, 서울: 16일 → 18일(23:59)
    expect(deadlineLabel({ recruitDeadlineAt: deadline, deadlineBadge: 'NORMAL' }, AS_OF, 'America/New_York')).toEqual({
      text: '~09-18 (D-3)',
      tone: 'normal',
    });
    expect(deadlineLabel({ recruitDeadlineAt: deadline, deadlineBadge: 'NORMAL' }, AS_OF, 'Asia/Seoul').text).toBe(
      '~09-18 (D-2)',
    );
  });

  it('서버가 임박(CLOSING_SOON)이라 해도 보통 행처럼 D-N 만 적는다', () => {
    const label = deadlineLabel({ recruitDeadlineAt: deadline, deadlineBadge: 'CLOSING_SOON' }, AS_OF, 'Asia/Seoul');
    expect(label).toEqual({ text: '~09-18 (D-2)', tone: 'normal' });
  });

  it('마감 당일은 「오늘 마감」이 아니라 D-0', () => {
    const sameDay = '2026-09-16T14:00:00Z'; // 서울 16일 23:00
    expect(deadlineLabel({ recruitDeadlineAt: sameDay, deadlineBadge: 'CLOSING_SOON' }, AS_OF, 'Asia/Seoul').text).toBe(
      '~09-16 (D-0)',
    );
  });

  it('닫힌 것만 따로 구분한다 — 마감 경과·정원 마감', () => {
    expect(
      deadlineLabel(
        { recruitDeadlineAt: '2026-09-15T14:59:00Z', deadlineBadge: 'DEADLINE_PASSED' },
        AS_OF,
        'Asia/Seoul',
      ),
    ).toEqual({ text: '~09-15 (마감 경과)', tone: 'closed' });
    expect(deadlineLabel({ recruitDeadlineAt: deadline, deadlineBadge: 'CAPACITY_FULL' }, AS_OF, 'Asia/Seoul')).toEqual(
      {
        text: '~09-18 (정원 마감)',
        tone: 'closed',
      },
    );
    expect(deadlineLabel({ recruitDeadlineAt: null, deadlineBadge: 'CAPACITY_FULL' }, AS_OF, 'Asia/Seoul').text).toBe(
      '정원 마감',
    );
  });

  it('마감 시각이 없으면 「마감일 미등록」', () => {
    expect(deadlineLabel({ recruitDeadlineAt: null, deadlineBadge: 'DEADLINE_MISSING' }, AS_OF, 'Asia/Seoul')).toEqual({
      text: '마감일 미등록',
      tone: 'muted',
    });
  });
});

describe('카테고리 이름', () => {
  it('코드를 화면 이름으로, 모르는 코드는 그대로', () => {
    expect(categoryLabel('AI_ML')).toBe('AI · ML');
    expect(categoryLabel('NEW_ONE')).toBe('NEW_ONE');
  });
});
