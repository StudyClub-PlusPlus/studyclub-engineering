import { classLabel, type StudyClass } from '@console/lib/classes';
import { bookFromSchedule, type NavigatorGroup, type ProtoMeeting } from '@core/lib/meetings';
import { classSource, type ScheduleSource } from '@core/lib/schedule-source';
import type { Crew, Study, StudyMeeting } from '@studyclub/mock';

/** 처음부터 있던 반 — 사용자 사이트의 그 분반과 같은 회차·규칙을 본다. */
export const FIRST_CLASS = 'c1';

/** 시각이 없는 반의 기본 시각. */
const DEFAULT_TIME = '20:00';

export type ClassCrew = Pick<Crew, 'id' | 'name'> & { role?: 'navigator' };

export type ClassView = {
  cls: StudyClass;
  /** 이 반의 회차·규칙 저장 키. 처음 반은 스터디 키 — 사용자 사이트 그 분반과 같은 곳을 읽고 쓴다. */
  key: string;
  crew: ClassCrew[];
  /** 「a, b」 — 없으면 「미지정」. */
  navigatorNames: string;
  source: ScheduleSource;
  group: NavigatorGroup;
  meetings: ProtoMeeting[];
  book: ReturnType<typeof bookFromSchedule>;
};

/**
 * 고른 반으로 일정 탭과 출석 탭이 쓰는 것을 한 번에 만든다. 반이 없으면 undefined.
 * TODO(api): GET /api/studies/{id}/groups/{groupId}/meetings
 */
export function classView({
  study,
  cls,
  base,
  crew,
  navigators,
}: {
  study: Study;
  cls: StudyClass | undefined;
  /** 반을 만들 때 진행 일정이 깐 회차. */
  base: StudyMeeting[];
  /** 이 반에 속한 크루. */
  crew: Crew[];
  /** 이 스터디의 네비게이터로 지정된 크루 ID. */
  navigators: string[];
}): ClassView | undefined {
  if (!cls) return undefined;
  const key = cls.id === FIRST_CLASS ? study.id : `${study.id}~${cls.id}`;
  const time = cls.rule.time || DEFAULT_TIME;
  const members: ClassCrew[] = crew.map((c) => ({
    id: c.id,
    name: c.name,
    role: navigators.includes(c.id) ? 'navigator' : undefined,
  }));
  const source = classSource({ key, base, timeZone: cls.rule.tz, time, people: members });
  const meetings = source.meetings();
  return {
    cls,
    key,
    crew: members,
    navigatorNames:
      members
        .filter((c) => c.role === 'navigator')
        .map((c) => c.name)
        .join(', ') || '미지정',
    source,
    group: { id: cls.id, name: classLabel(cls), timeZone: cls.rule.tz, startAt: time },
    meetings,
    book: bookFromSchedule(meetings),
  };
}
