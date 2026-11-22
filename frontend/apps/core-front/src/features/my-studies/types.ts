import type { Study, StudyMeeting } from '@studyclub/types';

export type JoinedRelation = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'WITHDRAWN';
export type JoinedParticipantRole = 'MEMBER' | 'LEADER';

export type ApiMyStudy = {
  studyId: number;
  title: string;
  category: string;
  studyKind: 'STUDY' | 'CLUB';
  startAt: string | null;
  endAt: string | null;
  relation: JoinedRelation;
  participantStatus?: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'WITHDRAWN' | 'DELETED';
  participantRole: JoinedParticipantRole | null;
  captain: boolean;
  discordChannelUrl: string | null;
  driveUrl: string | null;
  attendanceRate: number | null;
  meetings: ApiMyStudyMeeting[];
};

export type ApiMyStudies = { items: ApiMyStudy[] };

export type ApiMyStudyMeeting = {
  meetingId: number;
  sequence: number;
  scheduledAt: string;
  startAt: string | null;
  endAt: string | null;
  attendanceStatus: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED' | null;
  countedInRate: boolean;
};

export type Relation = JoinedRelation;

export type AttendanceMark = 'present' | 'late' | 'absent' | 'excused';
export type ScheduleRole = 'captain' | 'navigator' | 'crew';

export type JoinedMeeting = StudyMeeting & { scheduledAt: string; endAt?: string };

/** 카드 하나 — 스터디 + 나와의 관계 + 내 반 회차 + 회차별 내 출석. */
export type JoinedStudy = Study & {
  relation: Relation;
  role: ScheduleRole;
  meetings: JoinedMeeting[];
  /** 출석률 분모에 들어간 회차(`countedInRate`)만 채운다 — 완주 점수판이 같은 회차 집합을 본다. */
  myAttendance: Record<string, AttendanceMark | undefined>;
};
