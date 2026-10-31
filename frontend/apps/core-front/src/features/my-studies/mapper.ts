import { type StudyStatus } from '@studyclub/types';
import { CATEGORY_DISPLAY } from '@studyclub/utils';

import type { ApiMyStudy, AttendanceMark, JoinedMeeting, JoinedStudy, Relation } from './types';

const RELATION_STATUS: Record<Relation, StudyStatus> = {
  UPCOMING: 'recruiting',
  ONGOING: 'ongoing',
  COMPLETED: 'closed',
  WITHDRAWN: 'closed',
};

/** 회차 예정일 — KST 날짜. 주간 칸·기간 표기는 각자 타임존으로 다시 바꾼다. */
function kstDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(iso));
}

export function toJoinedStudy(api: ApiMyStudy): JoinedStudy {
  const id = String(api.studyId);
  const meetings: JoinedMeeting[] = api.meetings.map((m) => ({
    id: String(m.meetingId),
    no: m.sequence,
    date: kstDate(m.scheduledAt),
    scheduledAt: m.scheduledAt,
    endAt: m.endAt ?? undefined,
  }));
  const myAttendance = Object.fromEntries(
    api.meetings.map((m) => [
      String(m.meetingId),
      m.countedInRate && m.attendanceStatus ? (m.attendanceStatus.toLowerCase() as AttendanceMark) : undefined,
    ]),
  );
  return {
    id,
    study_id: api.studyId,
    format: 'online',
    title: { ko: api.title, en: api.title },
    summary: { ko: '', en: '' },
    status: RELATION_STATUS[api.relation],
    kind: api.studyKind === 'CLUB' ? 'club' : 'study',
    category: CATEGORY_DISPLAY[api.category] ?? api.category,
    startAt: api.startAt ?? undefined,
    discord_url: api.discordChannelUrl ?? undefined,
    driveUrl: api.driveUrl ?? undefined,
    relation: api.relation,
    role: api.captain ? 'captain' : api.participantRole === 'LEADER' ? 'navigator' : 'crew',
    meetings,
    myAttendance,
  };
}

export function joinedStudyIds(items: ApiMyStudy[]): string[] {
  return items.map((item) => String(item.studyId));
}
