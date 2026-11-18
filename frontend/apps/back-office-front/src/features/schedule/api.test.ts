import { describe, expect, it } from 'vitest';

import { toMeetings, toPeople, toUpdateBody } from '@/features/schedule/api';
import type { ApiGroupMeetings } from '@/features/schedule/repository';

const res: ApiGroupMeetings = {
  studyGroup: {
    id: 3,
    name: '목요일반',
    timezone: 'America/Los_Angeles',
    startTime: '19:00',
    navigatorName: null,
    rules: null,
    daysOfWeek: null,
  },
  me: { participantId: null, canEdit: true },
  participants: [{ participantId: 78, name: '건우' }],
  meetings: [
    {
      id: 40,
      type: 'KICKOFF',
      number: 0,
      scheduledAt: '2026-10-02T02:00:00Z',
      title: '킥오프',
      presenter1: null,
      presenter2: null,
      started: true,
    },
    {
      id: 41,
      type: 'REGULAR',
      number: 1,
      scheduledAt: '2026-10-09T02:00:00Z',
      title: null,
      presenter1: { participantId: 78, name: '건우' },
      presenter2: { participantId: 90, name: '떠난크루', active: false },
      started: false,
    },
  ],
};

describe('반 회차 목록 응답', () => {
  it('킥오프는 type 으로, 번호는 서버 값으로, 일자 · 시각은 반 시간대로 읽는다', () => {
    const [kickoff, first] = toMeetings(res);
    expect(kickoff).toMatchObject({
      id: '40',
      no: 0,
      kind: 'kickoff',
      date: '2026-10-01',
      time: '19:00',
      started: true,
    });
    expect(first).toMatchObject({
      id: '41',
      no: 1,
      kind: undefined,
      title: '',
      presenter1: '78',
      presenter2: '90',
      started: false,
    });
  });

  it('참여를 중단한 발표자도 이름을 적을 수 있게 사람 목록에 넣는다', () => {
    expect(toPeople(res)).toEqual([
      { id: '78', name: '건우' },
      { id: '90', name: '떠난크루' },
    ]);
  });
});

describe('회차 수정 본문', () => {
  // LA 2026-11-01 은 서머타임이 끝나는 날 — 01:30 이 PDT(08:30Z) · PST(09:30Z) 두 번 온다.
  // 밴쿠버는 2026-03-08 부터 UTC-7 고정이라(최신 tzdata) 겹치는 시각이 없어 예시로 못 쓴다.
  const tz = 'America/Los_Angeles';

  it('겹치는 시각의 두 번째 회차에서 제목만 고치면 예정 시각을 그대로 보낸다', () => {
    const body = toUpdateBody(
      { date: '2026-11-01', time: '01:30', title: '2장', scheduledAt: '2026-11-01T09:30:00.000Z' },
      tz,
    );
    expect(body.scheduledAt).toBe('2026-11-01T09:30:00.000Z');
    expect(body.title).toBe('2장');
  });

  it('일자 · 시각을 고쳤으면 반 시간대로 다시 계산한다', () => {
    const body = toUpdateBody(
      { date: '2026-11-08', time: '01:30', title: '', scheduledAt: '2026-11-01T09:30:00.000Z' },
      tz,
    );
    expect(body.scheduledAt).toBe('2026-11-08T09:30:00.000Z');
    expect(body.title).toBeNull();
  });
});
