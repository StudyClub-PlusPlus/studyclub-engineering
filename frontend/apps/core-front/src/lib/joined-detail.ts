import type { StudyMeeting } from '@studyclub/mock';

import { isKickoff } from './meetings';

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
