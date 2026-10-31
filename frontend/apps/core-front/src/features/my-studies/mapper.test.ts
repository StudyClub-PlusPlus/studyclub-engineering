import { describe, expect, it } from 'vitest';

import { toJoinedStudy } from '@/features/my-studies/mapper';

const base = {
  studyId: 12,
  title: 'DDIA',
  category: 'BACKEND',
  studyKind: 'STUDY' as const,
  startAt: '2026-09-01T00:00:00Z',
  endAt: null,
  relation: 'ONGOING' as const,
  participantRole: 'LEADER' as const,
  captain: false,
  discordChannelUrl: null,
  driveUrl: null,
  attendanceRate: 1,
  meetings: [
    {
      meetingId: 301,
      sequence: 1,
      // KST 로는 다음 날 새벽 — 날짜가 KST 기준으로 넘어가야 한다
      scheduledAt: '2026-09-02T16:00:00Z',
      startAt: null,
      endAt: '2026-09-02T17:30:00Z',
      attendanceStatus: 'LATE' as const,
      countedInRate: true,
    },
    {
      meetingId: 302,
      sequence: 2,
      scheduledAt: '2026-09-09T11:00:00Z',
      startAt: null,
      endAt: null,
      attendanceStatus: 'EXCUSED' as const,
      countedInRate: false,
    },
  ],
};

describe('toJoinedStudy', () => {
  it('서버의 관계·역할·회차·출석을 카드 모양으로 옮긴다', () => {
    const s = toJoinedStudy(base);
    expect(s.id).toBe('12');
    expect(s.role).toBe('navigator');
    expect(s.relation).toBe('ONGOING');
    expect(s.meetings[0]).toMatchObject({ id: '301', no: 1, date: '2026-09-03', endAt: '2026-09-02T17:30:00Z' });
    // 출석률 분모에 안 들어간 회차는 점수판에서 뺀다
    expect(s.myAttendance).toEqual({ '301': 'late', '302': undefined });
  });

  it('담당 캡틴이면 LEADER 여부와 상관없이 캡틴이다', () => {
    expect(toJoinedStudy({ ...base, participantRole: 'MEMBER', captain: true }).role).toBe('captain');
    expect(toJoinedStudy({ ...base, participantRole: 'MEMBER', captain: false }).role).toBe('crew');
  });
});
