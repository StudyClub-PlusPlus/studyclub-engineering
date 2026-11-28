import { describe, expect, it } from 'vitest';

import {
  RETRO_SECTIONS,
  deadlineText,
  endedRetroMeetings,
  myAnswers,
  pendingRetroCount,
  retroHref,
  saveFailureMessage,
  sectionEntries,
  validateRetro,
  writingStatus,
} from '@/features/meeting-retro/model';
import type { ApiRetroList, ApiRetroStatus } from '@/features/meeting-retro/types';
import type { ApiMeetingList } from '@/features/schedule/types';
import { ApiError } from '@/lib/http';

const NOW = Date.parse('2026-11-25T00:00:00Z');

function meeting(id: number, number: number, scheduledAt: string): ApiMeetingList['meetings'][number] {
  return {
    id,
    type: number === 0 ? 'KICKOFF' : 'REGULAR',
    number,
    scheduledAt,
    title: number === 0 ? '킥오프' : '',
    presenter1: null,
    presenter2: null,
    started: true,
  };
}

const meetings = [
  meeting(300, 0, '2026-11-03T11:00:00Z'),
  meeting(301, 1, '2026-11-10T11:00:00Z'),
  meeting(302, 2, '2026-11-17T11:00:00Z'),
  meeting(303, 3, '2026-11-24T11:00:00Z'),
  meeting(304, 4, '2026-12-01T11:00:00Z'),
];

const status: ApiRetroStatus = {
  meetings: [
    { meetingId: 300, retroDeadline: null, retroOpen: null, retroMine: null },
    { meetingId: 301, retroDeadline: '2026-11-17T11:00:00Z', retroOpen: false, retroMine: true },
    { meetingId: 302, retroDeadline: '2026-11-24T11:00:00Z', retroOpen: false, retroMine: false },
    { meetingId: 303, retroDeadline: '2026-12-01T11:00:00Z', retroOpen: true, retroMine: false },
    { meetingId: 304, retroDeadline: '2026-12-08T11:00:00Z', retroOpen: false, retroMine: false },
  ],
};

describe('endedRetroMeetings', () => {
  it('킥오프와 아직 안 끝난 회차를 빼고 오래된 회차부터 준다', () => {
    expect(endedRetroMeetings(status, meetings, NOW).map((m) => m.meetingId)).toEqual([301, 302, 303]);
  });

  it('서버가 준 미팅 종료로 가른다 — 끝난 직후라 아직 열리기 전이어도 끝난 회차다', () => {
    const withEnd: ApiRetroStatus = {
      meetings: [
        { meetingId: 303, meetingEndAt: '2026-11-24T13:00:00Z', retroDeadline: '2026-12-01T11:00:00Z', retroOpen: false, retroMine: false },
        { meetingId: 304, meetingEndAt: '2026-12-01T13:00:00Z', retroDeadline: '2026-12-08T11:00:00Z', retroOpen: false, retroMine: false },
      ],
    };
    expect(endedRetroMeetings(withEnd, meetings, NOW).map((m) => m.meetingId)).toEqual([303]);
  });

  it('응답이 아직 없으면 빈 목록', () => {
    expect(endedRetroMeetings(undefined, meetings, NOW)).toEqual([]);
  });
});

describe('pendingRetroCount', () => {
  it('열려 있고 내가 안 쓴 회차만 센다', () => {
    expect(pendingRetroCount(status)).toBe(1);
  });

  it('캡틴(retroMine null)은 0', () => {
    expect(
      pendingRetroCount({
        meetings: [{ meetingId: 303, retroDeadline: '2026-12-01T11:00:00Z', retroOpen: true, retroMine: null }],
      }),
    ).toBe(0);
  });
});

const list: ApiRetroList = {
  meetingId: 303,
  deadline: '2026-12-01T11:00:00Z',
  open: true,
  targets: null,
  missing: [],
  retros: [
    {
      retroId: 1,
      author: { participantId: 11, displayName: '민호', role: 'MEMBER' },
      good: '좋았어요',
      improve: '늦었어요',
      feeling: '',
      writtenAt: '2026-11-24T13:00:00Z',
      likes: { GOOD: 1, IMPROVE: 2, FEELING: 0 },
    },
    {
      retroId: 2,
      author: { participantId: 12, displayName: '하늘', role: 'MEMBER' },
      good: '예제가 좋았어요',
      improve: '자료 공유',
      feeling: '뿌듯해요',
      writtenAt: '2026-11-24T14:00:00Z',
      likes: { GOOD: 3, IMPROVE: 2, FEELING: 0 },
    },
  ],
};
const viewer = { participantId: 12, retroId: 2, liked: { '1': { GOOD: true, IMPROVE: false, FEELING: false } } };
const ME = 12;

describe('sectionEntries', () => {
  const [good, improve, feeling] = RETRO_SECTIONS;

  it('👍 많은 순, 같으면 쓴 순서', () => {
    expect(sectionEntries(list, viewer, good, ME).map((e) => e.retroId)).toEqual([2, 1]);
    expect(sectionEntries(list, viewer, improve, ME).map((e) => e.retroId)).toEqual([1, 2]);
  });

  it('👍 상태 응답이 없어도 내 답은 내 participantId 로 알아본다', () => {
    expect(sectionEntries(list, undefined, good, ME).find((e) => e.retroId === 2)?.me).toBe(true);
  });

  it('비운 소감은 빼고, 내 답과 내가 누른 👍 를 표시한다', () => {
    expect(sectionEntries(list, viewer, feeling, ME).map((e) => e.retroId)).toEqual([2]);
    const entries = sectionEntries(list, viewer, good, ME);
    expect(entries.find((e) => e.retroId === 2)?.me).toBe(true);
    expect(entries.find((e) => e.retroId === 1)?.liked).toBe(true);
  });
});

describe('myAnswers', () => {
  it('내 participantId 로 쓴 내용을 찾는다', () => {
    expect(myAnswers(list, ME)).toEqual({ good: '예제가 좋았어요', improve: '자료 공유', feeling: '뿌듯해요' });
    expect(myAnswers(list, 99)).toBeNull();
    expect(myAnswers(list, null)).toBeNull();
  });
});

describe('validateRetro', () => {
  it('공백만 있으면 빈 칸으로 본다', () => {
    expect(validateRetro({ good: '  ', improve: '', feeling: '' })).toEqual({
      good: '좋았던 점을 적어 주세요.',
      improve: '개선할 점을 적어 주세요.',
    });
  });

  it('소감은 비워도 되고 500자를 넘으면 막는다', () => {
    expect(validateRetro({ good: 'a', improve: 'b', feeling: '' })).toEqual({});
    expect(validateRetro({ good: 'a', improve: 'b', feeling: 'x'.repeat(501) })).toEqual({
      feeling: '500자까지 쓸 수 있어요.',
    });
  });
});

describe('표시', () => {
  it('기한은 프로필 시간대와 약칭으로 「까지 / 마감」', () => {
    expect(deadlineText({ deadline: '2026-12-01T11:00:00Z', open: true }, 'Asia/Seoul')).toBe('12.01 20:00 KST까지');
    expect(deadlineText({ deadline: '2026-11-24T11:00:00Z', open: false }, 'America/New_York')).toBe(
      '11.24 06:00 EST 마감',
    );
  });

  it('회고 주소', () => {
    expect(retroHref('ko', 5, 303)).toBe('/ko/my/joined/5/schedule/retro?meeting=303');
    expect(retroHref('ko', 5, 303, true)).toBe('/ko/my/joined/5/schedule/retro/write?meeting=303');
  });

  it('저장 실패 문구는 서버 오류 코드로 고른다', () => {
    expect(saveFailureMessage(new ApiError(409, 'x', { errorCode: 'RETRO_CLOSED' }))).toBe(
      '작성 기한이 지나 저장하지 못했어요.',
    );
    expect(saveFailureMessage(new Error('x'))).toBe('회고를 저장하지 못했어요. 다시 시도해 주세요.');
  });
});

describe('writingStatus', () => {
  it('크루(targets null)에게는 작성 현황이 없다', () => {
    expect(writingStatus(list, ME)).toBeNull();
  });

  it('네비게이터 · 캡틴은 쓴 사람이 앞, 안 쓴 사람이 뒤', () => {
    const lead = { ...list, targets: 3, missing: [{ participantId: 13, displayName: '소율' }] };
    const status = writingStatus(lead, ME);
    expect(status?.targets).toBe(3);
    expect(status?.written).toBe(2);
    expect(status?.rows.map((r) => [r.name, r.wrote, r.me])).toEqual([
      ['민호', true, false],
      ['하늘', true, true],
      ['소율', false, false],
    ]);
  });
});
