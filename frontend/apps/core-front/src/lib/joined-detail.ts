import type { StudyMeeting } from '@studyclub/mock';

import type { ApiMeetingList } from './joined-detail-api';
import { isKickoff, wallParts, type NavigatorGroup, type ProtoMeeting } from './meetings';

export type JoinedMeetingRow = StudyMeeting & { no: number };

/** 일정 표와 주간 일정이 같은 순서를 사용하도록 킥오프와 정규 회차를 정렬한다. */
export function meetingRows(meetings: StudyMeeting[]): JoinedMeetingRow[] {
  const sorted = [...meetings].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const kickoff = sorted.find(isKickoff);
  const regular = sorted
    .filter((meeting) => meeting !== kickoff)
    .map((meeting, index) => ({ ...meeting, no: index + 1 }));
  return kickoff ? [{ ...kickoff, no: 0 }, ...regular] : regular;
}

export function apiMeetingsOf(data: ApiMeetingList | undefined, group: NavigatorGroup): ProtoMeeting[] {
  return (data?.meetings ?? []).map((m) => {
    const isKickoffMeeting = m.type === 'KICKOFF' || m.number === 0 || m.title === '킥오프';
    return {
      id: String(m.id),
      no: isKickoffMeeting ? 0 : m.number,
      kind: isKickoffMeeting ? 'kickoff' : undefined,
      date: wallParts(new Date(m.scheduledAt), group.timeZone).date,
      time: wallParts(new Date(m.scheduledAt), group.timeZone).time,
      scheduledAt: m.scheduledAt,
      title: m.title ?? (isKickoffMeeting ? '킥오프' : ''),
      presenter1: m.presenter1 ? String(m.presenter1.participantId) : '',
      presenter2: m.presenter2 ? String(m.presenter2.participantId) : '',
    };
  });
}
