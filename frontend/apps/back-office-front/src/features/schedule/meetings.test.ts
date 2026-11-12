import { describe, expect, it } from 'vitest';

import {
  planDraft,
  previewOf,
  validateEdit,
  validateKickoff,
  type Meeting,
  type MeetingDraft,
} from '@/features/schedule/meetings';
import { wallParts, zonedInstant } from '@/features/schedule/time';

const NOW = new Date('2026-10-22T00:00:00Z');
const KST = 'Asia/Seoul';

function meeting(id: string, date: string, no: number, kind?: 'kickoff'): Meeting {
  return {
    id,
    no,
    kind,
    date,
    time: '20:00',
    scheduledAt: zonedInstant(date, '20:00', KST).toISOString(),
    title: '',
    presenter1: '',
    presenter2: '',
  };
}

const draft = (patch: Partial<MeetingDraft>): MeetingDraft => ({
  date: '2026-11-04',
  time: '20:00',
  title: '',
  repeat: 'none',
  until: '',
  weekdays: [],
  ...patch,
});

// 킥오프 10/28, 1회차 11/4, 2회차 11/11
const existing = [
  meeting('k', '2026-10-28', 0, 'kickoff'),
  meeting('m1', '2026-11-04', 1),
  meeting('m2', '2026-11-11', 2),
];

describe('시간대', () => {
  it('KST 벽시계를 UTC 로 바꾸고 PDT 로 다시 읽는다 — 목 21:00 KST 는 미국에서 수요일', () => {
    const at = zonedInstant('2026-10-22', '21:00', KST);
    expect(at.toISOString()).toBe('2026-10-22T12:00:00.000Z');
    expect(wallParts(at, 'America/Los_Angeles')).toEqual({ date: '2026-10-22', time: '05:00' });
    expect(wallParts(zonedInstant('2026-10-23', '05:00', KST), 'America/Los_Angeles').date).toBe('2026-10-22');
  });
});

describe('회차 추가 검사', () => {
  it('한 번만 만들 때 같은 날에 회차가 있으면 막는다', () => {
    expect(planDraft(draft({}), existing, KST, NOW).errors.date).toBe('이 날에는 이미 1회차가 있습니다.');
  });

  it('킥오프 날이나 그 앞이면 막는다', () => {
    expect(planDraft(draft({ date: '2026-10-28' }), existing, KST, NOW).errors.date).toBe(
      '킥오프(10/28(수)) 뒤로만 회차를 만들 수 있습니다.',
    );
  });

  it('지난 시각은 막는다', () => {
    expect(planDraft(draft({ date: '2026-10-21' }), [], KST, NOW).errors.time).toBe(
      '지난 시각으로는 회차를 만들 수 없습니다.',
    );
  });

  it('매주 반복은 이미 회차가 있는 날을 건너뛰고 나머지를 만든다', () => {
    const { plan } = planDraft(
      draft({ date: '2026-11-04', repeat: 'weekly', until: '2026-11-25', weekdays: [3] }),
      existing,
      KST,
      NOW,
    );
    expect(plan?.dates).toEqual(['2026-11-18', '2026-11-25']);
    expect(plan?.skipped.map((s) => s.reason)).toEqual(['이미 1회차', '이미 2회차']);
  });

  it('반복은 시작 일자 포함 31일까지', () => {
    const errors = planDraft(draft({ repeat: 'daily', until: '2026-12-05' }), [], KST, NOW).errors;
    expect(errors.until).toContain('31일 안에서만');
    expect(planDraft(draft({ repeat: 'daily', until: '2026-12-04' }), [], KST, NOW).plan?.dates).toHaveLength(31);
  });

  it('매주인데 요일을 하나도 안 고르면 막는다', () => {
    expect(planDraft(draft({ repeat: 'weekly', until: '2026-11-30' }), [], KST, NOW).errors.weekdays).toBe(
      '반복할 요일을 하나 이상 골라 주세요.',
    );
  });

  it('미리보기 — 끼어드는 회차는 번호를 밀고, 뒤에 붙으면 기간을 늘린다', () => {
    expect(previewOf({ dates: ['2026-11-07'], skipped: [] }, existing)).toEqual({
      from: 2,
      to: 2,
      shifted: 1,
      extendsTo: undefined,
    });
    expect(previewOf({ dates: ['2026-11-18'], skipped: [] }, existing).extendsTo).toBe('2026-11-18');
  });
});

describe('회차 수정 검사', () => {
  it('자기 자신과는 겹침을 따지지 않는다. 제목은 50자까지', () => {
    expect(validateEdit({ date: '2026-11-04', time: '21:00', title: '' }, 'm1', existing, KST, NOW)).toEqual({});
    expect(
      validateEdit({ date: '2026-11-04', time: '21:00', title: '가'.repeat(51) }, 'm1', existing, KST, NOW).title,
    ).toBe('제목은 50자까지 쓸 수 있습니다.');
  });
});

describe('킥오프 정하기 검사', () => {
  it('1회차 날이나 그 뒤면 막는다. 다른 회차와 같은 날도 막는다', () => {
    expect(validateKickoff({ date: '2026-11-04', time: '19:00' }, existing).date).toBe(
      '이 날에는 이미 1회차가 있습니다.',
    );
    expect(validateKickoff({ date: '2026-11-05', time: '19:00' }, existing).date).toBe(
      '킥오프는 1회차(11/4(수))보다 앞이어야 합니다.',
    );
  });

  it('지난 날도, 지금 킥오프와 같은 날도 받는다. 정규 회차가 없으면 아무 날이나', () => {
    expect(validateKickoff({ date: '2020-01-01', time: '19:00' }, existing)).toEqual({});
    expect(validateKickoff({ date: '2026-10-28', time: '21:00' }, existing)).toEqual({});
    expect(validateKickoff({ date: '2027-01-01', time: '19:00' }, [])).toEqual({});
    expect(validateKickoff({ date: '', time: '' }, [])).toEqual({
      date: '일자를 정해 주세요.',
      time: '시작 시각을 정해 주세요.',
    });
  });
});
