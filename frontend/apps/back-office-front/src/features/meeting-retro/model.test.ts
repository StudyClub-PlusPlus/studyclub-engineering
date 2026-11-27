import { describe, expect, it } from 'vitest';

import {
  RETRO_SECTIONS,
  deadlineText,
  endedRetroMeetings,
  retroMeetingOptions,
  sectionEntries,
  shortDateTime,
  writingRate,
  writingStatus,
} from '@/features/meeting-retro/model';
import type { ApiRetroList, ApiRetroStatus } from '@/features/meeting-retro/types';
import type { ApiMeeting } from '@/features/schedule/repository';

const meeting = (id: number, number: number, scheduledAt: string): ApiMeeting => ({
  id,
  type: number === 0 ? 'KICKOFF' : 'REGULAR',
  number,
  scheduledAt,
  title: null,
  presenter1: null,
  presenter2: null,
  started: true,
});

const NOW = Date.parse('2026-11-20T00:00:00Z');

describe('endedRetroMeetings', () => {
  const meetings = [
    meeting(10, 0, '2026-11-01T11:00:00Z'),
    meeting(12, 2, '2026-11-15T11:00:00Z'),
    meeting(11, 1, '2026-11-08T11:00:00Z'),
    meeting(13, 3, '2026-11-22T11:00:00Z'),
  ];
  const status: ApiRetroStatus = {
    meetings: [
      { meetingId: 10, meetingEndAt: null, retroDeadline: null, retroOpen: null, retroMine: null },
      {
        meetingId: 12,
        meetingEndAt: '2026-11-15T13:00:00Z',
        retroDeadline: '2026-11-22T11:00:00Z',
        retroOpen: true,
        retroMine: null,
      },
      {
        meetingId: 11,
        meetingEndAt: '2026-11-08T13:00:00Z',
        retroDeadline: '2026-11-15T11:00:00Z',
        retroOpen: false,
        retroMine: null,
      },
      {
        meetingId: 13,
        meetingEndAt: '2026-11-22T13:00:00Z',
        retroDeadline: '2026-11-29T13:00:00Z',
        retroOpen: false,
        retroMine: null,
      },
    ],
  };

  it('킥오프와 아직 안 끝난 회차를 빼고 오래된 회차부터 준다', () => {
    expect(endedRetroMeetings(status, meetings, NOW)).toEqual([
      { meetingId: 11, label: '1회차', scheduledAt: '2026-11-08T11:00:00Z', deadline: '2026-11-15T11:00:00Z', open: false },
      { meetingId: 12, label: '2회차', scheduledAt: '2026-11-15T11:00:00Z', deadline: '2026-11-22T11:00:00Z', open: true },
    ]);
  });

  it('응답을 아직 못 받았으면 빈 목록', () => {
    expect(endedRetroMeetings(undefined, meetings, NOW)).toEqual([]);
    expect(endedRetroMeetings(status, undefined, NOW)).toEqual([]);
  });
});

const list: ApiRetroList = {
  meetingId: 12,
  deadline: '2026-11-22T11:00:00Z',
  open: true,
  targets: 4,
  retros: [
    {
      retroId: 1,
      author: { participantId: 55, displayName: '민호', role: 'MEMBER' },
      good: '예제가 좋았어요',
      improve: '시간이 부족했어요',
      feeling: '',
      writtenAt: '2026-11-15T13:10:00Z',
      likes: { GOOD: 1, IMPROVE: 3, FEELING: 0 },
    },
    {
      retroId: 2,
      author: { participantId: 56, displayName: '하늘', role: 'LEADER' },
      good: '발표가 깔끔했어요',
      improve: '자료를 미리 주세요',
      feeling: '뿌듯해요',
      writtenAt: '2026-11-15T14:00:00Z',
      likes: { GOOD: 1, IMPROVE: 0 },
    },
  ],
  missing: [
    { participantId: 57, displayName: '지우' },
    { participantId: 58, displayName: '서연' },
  ],
};

describe('sectionEntries', () => {
  it('👍 많은 순, 같으면 쓴 순서', () => {
    const good = sectionEntries(list, RETRO_SECTIONS[0]);
    expect(good.map((e) => e.authorName)).toEqual(['민호', '하늘']);
    const improve = sectionEntries(list, RETRO_SECTIONS[1]);
    expect(improve.map((e) => [e.authorName, e.likes])).toEqual([
      ['민호', 3],
      ['하늘', 0],
    ]);
  });

  it('비운 소감은 빼고, 응답에 없는 👍 수는 0', () => {
    expect(sectionEntries(list, RETRO_SECTIONS[2])).toEqual([
      { retroId: 2, authorName: '하늘', answer: '뿌듯해요', likes: 0 },
    ]);
  });
});

describe('writingStatus', () => {
  it('쓴 사람이 앞, 안 쓴 사람이 뒤', () => {
    expect(writingStatus(list)).toEqual({
      targets: 4,
      written: 2,
      rows: [
        { participantId: 55, name: '민호', wrote: true },
        { participantId: 56, name: '하늘', wrote: true },
        { participantId: 57, name: '지우', wrote: false },
        { participantId: 58, name: '서연', wrote: false },
      ],
    });
  });

  it('서버가 targets 를 비워 주면 작성 현황을 그리지 않는다', () => {
    expect(writingStatus({ ...list, targets: null, missing: [] })).toBeNull();
  });
});

describe('표시', () => {
  it('표시 시간대의 벽시계와 약칭', () => {
    expect(shortDateTime('2026-11-22T11:00:00Z', 'Asia/Seoul')).toBe('11.22 20:00 KST');
  });

  it('마감 문구 — 열려 있으면 「까지」, 지났으면 「마감」', () => {
    expect(deadlineText({ deadline: '2026-11-22T11:00:00Z', open: true }, 'Asia/Seoul')).toBe('11.22 20:00 KST까지');
    expect(deadlineText({ deadline: '2026-11-22T11:00:00Z', open: false }, 'Asia/Seoul')).toBe('11.22 20:00 KST 마감');
  });
});

describe('writingRate', () => {
  const summary = { rows: 31, written: 21, closedRows: 24, closedWritten: 18, good: 21, improve: 21, feeling: 15 };

  it('기한 지난 줄 중 쓴 줄, 반올림한 정수 %', () => {
    expect(writingRate(summary)).toBe(75);
    expect(writingRate({ ...summary, closedRows: 3, closedWritten: 2 })).toBe(67);
  });

  it('기한 지난 회차가 없으면 null', () => {
    expect(writingRate({ ...summary, closedRows: 0, closedWritten: 0 })).toBeNull();
  });
});

describe('retroMeetingOptions', () => {
  const a = [
    meeting(30, 0, '2026-11-01T11:00:00Z'),
    meeting(32, 2, '2026-11-15T11:00:00Z'),
    meeting(31, 1, '2026-11-08T11:00:00Z'),
    meeting(33, 3, '2026-11-22T11:00:00Z'),
  ];

  it('반이 하나면 시작한 정규 회차만 회차순, 반 이름 없이', () => {
    expect(retroMeetingOptions([{ groupId: 1, name: '기본반', meetings: a }], NOW)).toEqual([
      { value: '31', label: '1회차' },
      { value: '32', label: '2회차' },
    ]);
  });

  it('반이 여럿이면 「반 · n회차」, 회차를 아직 못 받은 반은 건너뛴다', () => {
    expect(
      retroMeetingOptions(
        [
          { groupId: 1, name: 'A반', meetings: a },
          { groupId: 2, name: 'B반', meetings: [meeting(41, 1, '2026-11-09T11:00:00Z')] },
          { groupId: 3, name: 'C반', meetings: undefined },
        ],
        NOW,
      ).map((o) => o.label),
    ).toEqual(['A반 · 1회차', 'A반 · 2회차', 'B반 · 1회차']);
  });
});
