// 내 스터디 — GET /api/me/studies (specs/my-studies/spec.md). 키·fetcher·훅을 한곳에. 브라우저가 백엔드를 직접 부른다.
import { CATEGORY_DISPLAY, type StudyMeeting } from '@studyclub/mock';
import { useQuery } from '@tanstack/react-query';

import { http } from '../../lib/http'; // 상대 경로 — vitest 에 @ 별칭이 없다
import type { Study, StudyStatus } from '@/lib/content';

type ApiAttendanceStatus = 'PRESENT' | 'LATE' | 'EXCUSED' | 'ABSENT';
export type Relation = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'WITHDRAWN';

type ApiMyMeeting = {
  meetingId: number;
  sequence: number;
  scheduledAt: string;
  startAt: string | null;
  endAt: string | null;
  attendanceStatus: ApiAttendanceStatus | null;
  countedInRate: boolean;
};

type ApiMyStudy = {
  studyId: number;
  title: string;
  category: string;
  studyKind: 'STUDY' | 'CLUB';
  startAt: string | null;
  endAt: string | null;
  relation: Relation;
  participantRole: 'MEMBER' | 'LEADER' | null;
  /** 담당 캡틴 — 이 스터디를 만든 캡틴(`STUDY.CREATED_BY = 나`). 신청했을 때만 명부에 있다. */
  captain: boolean;
  discordChannelUrl: string | null;
  driveUrl: string | null;
  attendanceRate: number | null;
  meetings: ApiMyMeeting[];
};

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

export const myStudyKeys = {
  // 계정을 키에 넣는다 — 같은 브라우저에서 다른 계정으로 다시 로그인해도 앞 사람의 목록이 보이지 않는다
  list: (accountId: number) => ['my-studies', accountId] as const,
};

export function useMyStudies(accountId: number | undefined) {
  return useQuery({
    queryKey: myStudyKeys.list(accountId ?? 0),
    queryFn: async () => {
      const res = await http<{ items: ApiMyStudy[] }>('/api/me/studies');
      return res.items.map(toJoinedStudy);
    },
    enabled: accountId !== undefined,
  });
}
