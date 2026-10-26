import { describe, expect, it } from 'vitest';

import { toMeetings, toPeople, type ApiGroupMeetings } from './api';

const res: ApiGroupMeetings = {
  studyGroup: {
    id: 3,
    name: '목요일반',
    timezone: 'America/Los_Angeles',
    startTime: '19:00',
    navigatorName: null,
    rules: null,
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
