import { describe, expect, it } from 'vitest';

import { toBook, toUpdates } from './api';
import type { ApiAttendance } from './repository';
import { toUpdateBody } from '@/features/schedule/api';

const participant = (id: number, attendances: ApiAttendance['participants'][number]['attendances']) => ({
  participantId: id,
  displayName: `p${id}`,
  participantRole: 'MEMBER',
  captain: false,
  participantStatus: 'ACTIVE',
  leftAt: null,
  attendances,
  attendanceRate: null,
});

describe('출석 명부 변환', () => {
  it('응답을 참가자 → 회차 → 상태로 펼치고, 미입력(null) 칸은 비운다', () => {
    const res: ApiAttendance = {
      study: { id: 1, title: '', participantCount: 1, totalMeetings: 2, avgAttendanceRate: null },
      meetings: [
        { id: 11, scheduledAt: '2026-01-08T11:00:00Z' },
        { id: 12, scheduledAt: '2026-01-15T11:00:00Z' },
      ],
      participants: [
        participant(1, [
          { meetingId: 11, status: 'EXCUSED' },
          { meetingId: 12, status: null },
        ]),
      ],
    };
    expect(toBook(res)).toEqual({ '1': { '11': 'excused' } });
  });

  it('시작 전 회차의 결석은 비운다 — 서버가 회차를 추가할 때 미리 만든 값이다', () => {
    const res: ApiAttendance = {
      study: { id: 1, title: '', participantCount: 1, totalMeetings: 2, avgAttendanceRate: null },
      meetings: [
        { id: 11, scheduledAt: '2026-01-08T11:00:00Z' },
        { id: 12, scheduledAt: '2026-01-15T11:00:00Z' },
      ],
      participants: [
        participant(1, [
          { meetingId: 11, status: 'ABSENT' },
          { meetingId: 12, status: 'ABSENT' },
        ]),
        participant(2, [{ meetingId: 12, status: 'EXCUSED' }]),
      ],
    };
    // 11 은 지났고 12 는 아직이다 — 12 의 결석만 빈칸, 미리 낸 휴가는 남는다
    expect(toBook(res, new Date('2026-01-10T00:00:00Z'))).toEqual({
      '1': { '11': 'absent' },
      '2': { '12': 'excused' },
    });
  });

  it('지금 열에서 바뀐 칸만 보내고, 미체크로 되돌린 칸은 따로 센다 — 서버는 칸을 비우지 못한다', () => {
    const saved = { '1': { '11': 'absent' as const, '12': 'present' as const, '99': 'late' as const } };
    const next = { '1': { '11': 'late' as const, '99': 'present' as const }, '2': { '12': 'excused' as const } };
    expect(toUpdates(saved, next, ['11', '12'])).toEqual({
      updates: [
        { meetingId: 11, participantId: 1, status: 'LATE' },
        { meetingId: 12, participantId: 2, status: 'EXCUSED' },
      ],
      cleared: 1,
    });
  });
});

describe('회차 수정 본문', () => {
  it('발표자는 넘긴 칸만 — 없으면 키를 빼고, 비우면 null', () => {
    const body = toUpdateBody({ date: '2026-01-08', time: '20:00', title: ' ', presenter2: null }, 'Asia/Seoul');
    expect(body).toEqual({ scheduledAt: '2026-01-08T11:00:00.000Z', title: null, presenter2ParticipantId: null });
    expect(
      toUpdateBody({ date: '2026-01-08', time: '20:00', title: '1장', presenter1: '7' }, 'Asia/Seoul'),
    ).toMatchObject({
      title: '1장',
      presenter1ParticipantId: 7,
    });
  });
});
