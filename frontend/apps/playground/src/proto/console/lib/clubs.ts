import type { AttendanceStatus } from '@studyclub/types';

/**
 * 클럽 운영 프로토의 데이터.
 *
 * 클럽 기수는 **달 하나**다 — 1일에 시작해 말일에 끝난다. 모집은 그 전달에 열려 말일에 닫힌다.
 * 회차(모임)가 없으므로 출석부의 열은 그 달의 날짜다.
 *
 * TODO(api): 클럽 · 기수 · 참여자 · 출석은 서버 값으로 바꾼다. 프로토는 고정된 「오늘」 위에서 화면 상태로만 움직인다.
 */

export type ClubKey = 'earlybird' | 'weeklyx' | 'leetcode';

/** 클럽마다 다른 것 — 출석 값 · 날짜 기준 · 신청 때 받는 값. */
export type ClubConfig = {
  key: ClubKey;
  /** 프로그램 제목 — 기수 제목의 앞부분 */
  title: string;
  /** 출석부에 쓰는 값. 순서가 칸을 누를 때 도는 순서다 */
  statuses: AttendanceStatus[];
  /** 날짜를 가르는 기준. LeetCode 는 UTC 0시에 하루가 바뀐다 */
  dayBasis: 'member' | 'utc';
  /** 신청 때 받아 명단 · 출석부에 함께 보여 주는 값 */
  extra?: { label: string; key: 'wake' | 'leetcode' };
  /** 기수 정원. 없으면 제한 없음 */
  capacity?: number;
};

export const CLUBS: ClubConfig[] = [
  {
    key: 'earlybird',
    title: '얼리버드',
    statuses: ['present', 'late', 'absent', 'excused'],
    dayBasis: 'member',
    extra: { label: '기상 목표', key: 'wake' },
    capacity: 30,
  },
  {
    key: 'weeklyx',
    title: 'WEEKLY X',
    statuses: ['present', 'absent', 'excused'],
    dayBasis: 'member',
    capacity: 30,
  },
  {
    key: 'leetcode',
    title: 'Daily LeetCode',
    statuses: ['present', 'absent', 'excused'],
    dayBasis: 'utc',
    extra: { label: 'LeetCode ID', key: 'leetcode' },
  },
];

export function clubOf(key: ClubKey): ClubConfig {
  return CLUBS.find((c) => c.key === key) ?? CLUBS[0];
}

/** 프로토의 「오늘」 두 가지 — 다음 기수 초안이 만들어지기 전과 뒤. */
export type DemoDay = 'before' | 'after';
export const DEMO_TODAY: Record<DemoDay, string> = { before: '2026-12-10', after: '2026-12-16' };

/** 자동 초안 만드는 날의 기본값 — 캡틴이 지금 모집을 여는 15~20일 중 첫날. */
export const DEFAULT_DRAFT_DAY = 15;

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

/** 기수 제목 — 「얼리버드 2027년 1월」. 같은 클럽에서 달이 겹치지 않으니 제목도 겹치지 않는다. */
export function cohortTitle(club: ClubConfig, m: Month): string {
  return `${club.title} ${m.year}년 ${m.month}월`;
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
  /** 기상 목표 시각 또는 LeetCode 아이디 — 신청 답변 */
  extra?: string;
  /** 참여 중단 날짜 (이번 기수 안). 없으면 참여 중 */
  leftOn?: string;
  /** 이번 기수에 처음 들어왔는가 (신청) · 지난 기수에서 넘어왔는가 */
  joined: 'carried' | 'applied';
};

const NAMES = [
  '새벽세시',
  '모닝커피',
  '코딩하는곰',
  '꾸준함',
  '하루한걸음',
  '오늘도출근',
  '데이터덕후',
  '느린거북',
  '알고리즘초보',
  '산책러',
  '책벌레',
  '밤샘금지',
];

const WAKE = ['05:30', '06:00', '06:00', '05:00', '06:30', '05:45', '06:00', '07:00', '05:30', '06:15', '06:00', '05:30'];

/** 이번 기수 명단. 클럽마다 사람 수와 중단한 사람이 조금씩 다르다. */
export function seedMembers(club: ClubConfig): ClubMember[] {
  const size = club.key === 'earlybird' ? 12 : club.key === 'weeklyx' ? 10 : 9;
  return NAMES.slice(0, size).map((name, i) => ({
    id: `${club.key}-${i + 1}`,
    name,
    extra:
      club.extra?.key === 'wake'
        ? WAKE[i]
        : club.extra?.key === 'leetcode'
          ? `lc_${['dawn', 'bear', 'step', 'turtle', 'walker', 'owl', 'data', 'book', 'cup'][i] ?? i}`
          : undefined,
    leftOn: i === 7 ? '2026-12-08' : undefined,
    joined: i < size - 3 ? 'carried' : 'applied',
  }));
}

export type ClubBook = Record<string, Record<string, AttendanceStatus>>;

/**
 * 이번 달 출석 — 캡틴이 시트와 함께 쓰므로 빈 날이 섞여 있다.
 * 1일부터 「오늘 − 3일」까지만 채운다 (시트에서 옮기는 데 며칠 걸린다).
 */
export function seedBook(club: ClubConfig, members: ClubMember[], today: string): ClubBook {
  const m = monthOf(today);
  const last = Number(today.slice(8, 10)) - 3;
  const book: ClubBook = {};
  members.forEach((mem, i) => {
    const row: Record<string, AttendanceStatus> = {};
    for (let d = 1; d <= last; d++) {
      const day = isoDay(m, d);
      if (mem.leftOn && day > mem.leftOn) break;
      const r = (i * 7 + d * 13) % 17;
      let s: AttendanceStatus = r < 11 ? 'present' : r < 14 ? 'absent' : 'excused';
      if (club.statuses.includes('late') && r === 3) s = 'late';
      if (mem.leftOn && r > 6) s = 'absent';
      row[day] = s;
    }
    book[mem.id] = row;
  });
  return book;
}

/** 출석률(%) — 출석 1, 지각 0.5. 분모는 기록된 날에서 휴가를 뺀 것. 기록 없는 날은 넣지 않는다. */
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

/** 시트에서 붙여넣은 값 하나를 출석 값으로. 모르는 값은 undefined, 빈 칸은 null(그대로 둔다). */
export function parseSheetValue(raw: string, club: ClubConfig): AttendanceStatus | null | undefined {
  const v = raw.trim().toUpperCase();
  if (v === '') return null;
  let s: AttendanceStatus | undefined;
  if (['O', '1', '출석', 'V', '✓', '✔'].includes(v)) s = 'present';
  else if (['△', '(O)', '지각', '0.5'].includes(v)) s = 'late';
  else if (['X', '0', '결석', '-'].includes(v)) s = 'absent';
  else if (['휴', '휴가', 'E'].includes(v)) s = 'excused';
  if (s && !club.statuses.includes(s)) return undefined;
  return s;
}
