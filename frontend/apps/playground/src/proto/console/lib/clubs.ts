import { studies } from '@studyclub/mock';
import type { AttendanceStatus, Study } from '@studyclub/types';

/**
 * 클럽 운영 프로토의 데이터.
 *
 * 클럽 기수는 **달 하나**다 — 1일에 시작해 말일에 끝난다. 모집은 그 전달에 열려 말일에 닫힌다.
 * 회차(모임)가 없으므로 출석부의 열은 그 달의 날짜다.
 *
 * TODO(api): 클럽 · 기수 · 참여자 · 출석은 서버 값으로 바꾼다. 프로토는 고정된 「오늘」 위에서 화면 상태로만 움직인다.
 */

export type ClubKey = 'earlybird' | 'weeklyx' | 'leetcode';

/**
 * 클럽마다 다른 것. **클럽 이름으로 분기하지 않는다** — 모두 프로그램 · 기수 · 신청 폼의 설정 값이다.
 * 새 클럽이 생겨도 코드를 고치지 않고 설정으로 만든다.
 */
export type ClubConfig = {
  /** 프로토 안에서 클럽을 가리키는 키 (서버는 STUDY_PROGRAM.ID) */
  key: ClubKey;
  /** STUDY_PROGRAM.TITLE — 기수 제목(STUDY.TITLE)도 이 이름 그대로다 */
  title: string;
  /** STUDY.TIME_ZONE — 출석부의 날짜를 가르는 시간대. 기존 기수 시간대 값을 그대로 쓴다 */
  timeZone: string;
  /** 신청 폼에서 「명단에 보이기」를 켠 질문 — 그 답을 명단 · 출석부에 보인다 */
  rosterQuestion?: { label: string };
  /** STUDY_RECRUITMENT.CAPACITY — 이번 기수 정원. 다음 기수 초안이 복사한다. 없으면 제한 없음 */
  capacity?: number;
  /** 프로토 전용 — 이번 기수에 해당하는 mock 스터디 */
  mockStudy: string;
};

/** 출석 값 — 스터디와 같다. 순서가 칸을 누를 때 도는 순서다 */
export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['present', 'late', 'absent', 'excused'];

/** 프로그램 기본 시간대 — 이것과 다른 시간대의 클럽만 화면에 날짜 기준을 알린다 */
export const DEFAULT_TIME_ZONE = 'Asia/Seoul';

/** 프로토의 세 클럽 — 2026-11 캡틴 답변 기준 설정 값 */
export const CLUBS: ClubConfig[] = [
  {
    key: 'earlybird',
    title: '얼리버드',
    timeZone: DEFAULT_TIME_ZONE,
    rosterQuestion: { label: '기상 목표' },
    capacity: 30,
    mockStudy: 'early-bird',
  },
  {
    key: 'weeklyx',
    title: 'WEEKLY X',
    timeZone: DEFAULT_TIME_ZONE,
    capacity: 30,
    mockStudy: 'weeklyx',
  },
  {
    key: 'leetcode',
    title: 'Daily LeetCode',
    timeZone: 'UTC',
    rosterQuestion: { label: 'LeetCode ID' },
    mockStudy: 'daily-leetcode',
  },
];

/** 이번 기수의 스터디 상세 주소 값(study_id). 신청 폼 · 신청자는 그 화면이 맡는다 */
export function clubStudyId(club: ClubConfig): number | undefined {
  return studies.find((s) => s.id === club.mockStudy)?.study_id;
}

export function clubOf(key: ClubKey): ClubConfig {
  return CLUBS.find((c) => c.key === key) ?? CLUBS[0];
}

/** 자동 초안 만드는 날의 기본값 — 15일에 미공개로 만들고 */
export const DEFAULT_DRAFT_DAY = 15;
/** 자동 공개하는 날의 기본값 — 20일에 공개해 모집을 연다. 캡틴은 그 전에 먼저 열 수 있다 */
export const DEFAULT_PUBLISH_DAY = 20;

export type Month = { year: number; month: number };

export function monthOf(iso: string): Month {
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) };
}

export function nextMonth({ year, month }: Month): Month {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

export function daysIn({ year, month }: Month): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isoDay({ year, month }: Month, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * 운영 화면의 기수 이름 — 「얼리버드 · 2027년 1월」.
 * 기수 제목(STUDY.TITLE)은 클럽 이름 그대로라 크루에게는 「얼리버드」로만 보인다. 운영 화면만 COHORT_MONTH 를 붙여 구별한다.
 */
export function cohortTitle(club: ClubConfig, m: Month): string {
  return `${club.title} · ${m.year}년 ${m.month}월`;
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
export function weekdayOf(iso: string): string {
  return WEEKDAY[new Date(`${iso}T00:00:00Z`).getUTCDay()];
}

/** 「12/31(목)」 */
export function shortDate(iso: string): string {
  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}(${weekdayOf(iso)})`;
}

export type ClubMember = {
  id: string;
  /** 디스코드 별명 — 시트에서 붙여넣을 때 이 이름으로 찾는다 */
  name: string;
  /** 「명단에 보이기」 질문의 답 */
  extra?: string;
  /** 참여 중단 날짜 (이번 기수 안). 없으면 참여 중 */
  leftOn?: string;
  /** 이번 기수에 처음 들어왔는가 (신청) · 지난 기수에서 넘어왔는가 */
  joined: 'carried' | 'applied';
};

export type ClubBook = Record<string, Record<string, AttendanceStatus>>;

/** 출석률(%) — 스터디 출석률 산식 그대로 (specs/attendance). 출석 1 · 지각 0.5, 분모는 기록된 날에서 휴가를 뺀 것. 기록 없는 날은 넣지 않는다. */
export function clubRate(row: Record<string, AttendanceStatus> | undefined): number | undefined {
  let score = 0;
  let total = 0;
  for (const s of Object.values(row ?? {})) {
    if (s === 'excused') continue;
    total += 1;
    if (s === 'present') score += 1;
    if (s === 'late') score += 0.5;
  }
  return total === 0 ? undefined : Math.round((score / total) * 100);
}

/**
 * 기수 출석률(%) — 스터디 평균과 같은 가중평균. 사람마다 분자 · 분모를 모두 더해 나눈다(사람별 출석률을 다시 평균하지 않는다).
 * 기록이 하나도 없으면 undefined.
 */
export function clubAverageRate(book: ClubBook): number | undefined {
  let score = 0;
  let total = 0;
  for (const row of Object.values(book)) {
    for (const s of Object.values(row)) {
      if (s === 'excused') continue;
      total += 1;
      if (s === 'present') score += 1;
      if (s === 'late') score += 0.5;
    }
  }
  return total === 0 ? undefined : Math.round((score / total) * 100);
}

/** 출석 일수 — 지각은 0.5일 */
export function clubDays(row: Record<string, AttendanceStatus> | undefined): number {
  let n = 0;
  for (const s of Object.values(row ?? {})) {
    if (s === 'present') n += 1;
    if (s === 'late') n += 0.5;
  }
  return n;
}

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: '출석',
  late: '지각',
  absent: '결석',
  excused: '휴가',
};

/** 지난 기수 한 줄 — 끝난 달의 집계 */
export type PastCohort = {
  month: Month;
  /** 기수 첫날 참여자 */
  members: number;
  completed: number;
  withdrawn: number;
  /** 다음 기수로 넘어간 사람 */
  carried: number;
  /** 참여자 출석률 평균 (%) */
  rate: number;
};

export function prevMonth({ year, month }: Month): Month {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

/**
 * 스터디(기수) → 클럽 설정. 같은 프로그램이면 같은 설정이다 — 제목 · 이름으로 찾지 않는다.
 * 클럽이 아니거나 설정이 없으면 undefined.
 */
export function clubOfStudy(study: Pick<Study, 'program'>): ClubConfig | undefined {
  if (study.program?.kind !== 'club') return undefined;
  return CLUBS.find((c) => studies.find((s) => s.id === c.mockStudy)?.program?.id === study.program?.id);
}
