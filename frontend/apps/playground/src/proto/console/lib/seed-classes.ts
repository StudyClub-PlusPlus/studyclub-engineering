import type { StudyClass } from '@console/lib/classes';
import { ruleFromMeetings, type StudyTz } from '@console/lib/schedule';
import type { AttendanceStatus, Study, StudyCrewData, StudyMeeting } from '@studyclub/mock';

/**
 * 프로토 mock — 분반이 여럿인 스터디.
 *
 * 처음 반(`c1`)은 스터디 mock 회차에서 진행 일정을 되읽는다. 여기 적은 반은 그 뒤에 붙는다.
 * 반 이름은 따로 받지 않는다 — 일정이 곧 이름이다(「금 19:00 PDT」).
 *
 * TODO(api): GET /api/studies/{id}/groups
 */
type ExtraClass = {
  id: string;
  /** 0=일 … 6=토. 이 반이 모이는 요일. */
  weekday: number;
  time: string;
  tz: StudyTz;
};

const EXTRA_CLASSES: Record<string, ExtraClass[]> = {
  'ddia-2nd': [
    // 미국 금요일반 — 금 7PM PDT
    { id: 'c2', weekday: 5, time: '19:00', tz: 'America/Los_Angeles' },
    // 미국 토요일반 — 토 5PM PDT
    { id: 'c3', weekday: 6, time: '17:00', tz: 'America/Los_Angeles' },
  ],
};

/** 지난 회차에 덮는 데모 출석 — 스터디 mock 과 같은 순환. */
const DEMO_CYCLE: AttendanceStatus[] = ['present', 'late', 'present', 'late', 'absent', 'excused'];

function shiftToWeekday(ymd: string, weekday: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + ((weekday - d.getUTCDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}

export type SeededClasses = {
  classes: StudyClass[];
  meetings: Record<string, StudyMeeting[]>;
  assign: Record<string, string>;
  attendance: StudyCrewData['attendance'];
  /** 이 스터디의 네비게이터로 지정된 크루. 분반 mock 이 있는 스터디는 반마다 첫 크루를 둔다. */
  navigators: string[];
};

/**
 * 스터디 운영 화면의 첫 상태 — 반 · 반별 회차 · 크루의 반 · 출석.
 *
 * 분반 mock 이 있는 스터디는 크루를 반마다 고르게 나누고, 각 반 회차는 처음 반과 같은 주에 그 반 요일로 깐다.
 * 반을 옮긴 크루의 출석은 그 반 회차로 다시 만든다 — 남의 반 회차에 출석이 찍혀 있으면 안 된다.
 */
export function seedClasses(
  study: Study,
  initial: StudyCrewData,
  firstId: string,
  today = new Date().toISOString().slice(0, 10),
): SeededClasses {
  const first: StudyClass = { id: firstId, rule: ruleFromMeetings(study, initial.meetings) };
  const extras = EXTRA_CLASSES[study.id] ?? [];
  const out: SeededClasses = {
    classes: [first],
    meetings: { [firstId]: initial.meetings },
    assign: Object.fromEntries(initial.crew.map((c) => [c.id, firstId])),
    attendance: initial.attendance,
    navigators: [],
  };
  if (extras.length === 0) return out;

  const ids = [firstId, ...extras.map((x) => x.id)];
  const attendance = { ...initial.attendance };
  for (const x of extras) {
    // 처음 반과 같은 주에 모인다 — 기간이 같아야 반끼리 진도를 견준다.
    const dates = initial.meetings.map((m) => shiftToWeekday(m.date, x.weekday));
    const meetings = dates.map((date, i) => ({ id: `${study.id}-${x.id}-s${i + 1}`, no: i + 1, date }));
    out.classes.push({
      id: x.id,
      rule: {
        startDate: dates[0] ?? '',
        endDate: dates[dates.length - 1] ?? '',
        weekdays: [x.weekday],
        time: x.time,
        tz: x.tz,
      },
    });
    out.meetings[x.id] = meetings;

    initial.crew.forEach((c, i) => {
      if (ids[i % ids.length] !== x.id) return;
      out.assign[c.id] = x.id;
      const row: Record<string, AttendanceStatus> = {};
      meetings
        .filter((m) => m.date <= today)
        .forEach((m, n) => {
          row[m.id] = DEMO_CYCLE[n % DEMO_CYCLE.length]!;
        });
      attendance[c.id] = row;
    });
  }
  out.attendance = attendance;
  // 반마다 네비게이터 한 명 — 반 정보 카드의 「네비게이터」가 비지 않게.
  out.navigators = ids
    .map((id) => initial.crew.find((c) => out.assign[c.id] === id)?.id)
    .filter((id): id is string => Boolean(id));
  return out;
}
