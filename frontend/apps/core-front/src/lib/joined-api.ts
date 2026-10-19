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
  participantStatus: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'WITHDRAWN' | 'DELETED';
  participantRole: JoinedParticipantRole;
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

export function joinedStudyIds(items: ApiMyStudy[]): string[] {
  return items.map((item) => String(item.studyId));
}
