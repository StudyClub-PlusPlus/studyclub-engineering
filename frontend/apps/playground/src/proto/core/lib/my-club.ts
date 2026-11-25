import type { ClubConfig } from '@console/lib/clubs';

/**
 * 「내 클럽」 — 크루가 자기 클럽에서 매일 쓰는 화면의 데이터와 계산.
 *
 * 날 단위 클럽(얼리버드 · Daily LeetCode)은 날마다 인증 한 칸, 주 단위 클럽(WEEKLY X)은 날마다 공부 시간 +
 * 주마다 목표 · 회고다. 어느 쪽인지는 클럽 설정(`ClubConfig.rules`)이 정한다 — 클럽 이름으로 나누지 않는다.
 *
 * 날짜는 시간대 없는 그날이다 (POL-0012). 주는 월요일 ~ 일요일이고, **월요일이 속한 달**에 센다.
 *
 * TODO(api): GET /api/clubs/{programId}/me — 멤버 · 이번 달 인증 · 주 기록 · 지난 달 결과
 */

export type DayMark = 'present' | 'late' | 'absent' | 'excused';

export type WeekEntry = {
  /** 목표 시간(분). 비어 있으면 지난주 목표를 이어 쓴다 */
  goalMin?: number;
  goalText?: string;
  /** 크루가 이번 주를 휴가로 썼다 */
  vacation?: boolean;
  retro?: { good: string; next?: string; at: string };
};

export type MyClubState = {
  /** 날 단위 인증 — YYYY-MM-DD → 값 */
  days: Record<string, DayMark>;
  /** 인증에 남긴 메모 한 줄 */
  notes: Record<string, string>;
  /** 주 단위 — 그날 공부 시간(분) */
  minutes: Record<string, number>;
  /** 주 단위 — 그 주 월요일 → 목표 · 회고 */
  weeks: Record<string, WeekEntry>;
  /** 주 단위 — 신청 때 쓴 목표(분). 첫 주 목표의 기본값. 신청서의 「명단에 보이기」 답에서 온다 */
  appliedGoalMin: number;
};

export type MonthResult = { month: string; result: 'completed' | 'withdrawn'; rate: number };

/** 검토용 「오늘」 — 평일(수) · 회고가 열리는 일요일 · 목표를 쓰는 월요일 */
export type DemoDay = 'wed' | 'sun' | 'mon';
export const DEMO_DAYS: Record<DemoDay, string> = { wed: '2026-12-16', sun: '2026-12-20', mon: '2026-12-21' };
export const DEMO_LABEL: Record<DemoDay, string> = { wed: '12/16(수)', sun: '12/20(일)', mon: '12/21(월)' };

const WD = ['일', '월', '화', '수', '목', '금', '토'];

export function parse(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(day: string, n: number): string {
  const d = parse(day);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}
export function weekday(day: string): number {
  return parse(day).getUTCDay();
}
/** 「12/16(수)」 */
export function shortDay(day: string): string {
  const d = parse(day);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WD[d.getUTCDay()]})`;
}
export function mondayOf(day: string): string {
  const wd = weekday(day);
  return addDays(day, wd === 0 ? -6 : 1 - wd);
}
export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
export function monthKey(day: string): string {
  return day.slice(0, 7);
}
export function daysOfMonth(month: string): string[] {
  const first = `${month}-01`;
  const out: string[] = [];
  for (let d = first; monthKey(d) === month; d = addDays(d, 1)) out.push(d);
  return out;
}
/** 그 달에 세는 주 — 월요일이 그 달에 있는 주 */
export function weeksOfMonth(month: string): string[] {
  return daysOfMonth(month).filter((d) => weekday(d) === 1);
}

/** 「2시간 30분」 · 「45분」 · 「0분」 */
export function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}시간 ${m}분`;
  if (h) return `${h}시간`;
  return `${m}분`;
}

/** 출석률 — 스터디 산식과 같다: 출석 1 · 지각 0.5, 휴가 · 기록 없는 날은 분모에서 뺀다 */
export function dayRate(state: MyClubState, month: string, today: string): number | null {
  const counted = daysOfMonth(month).filter((d) => d <= today && state.days[d] && state.days[d] !== 'excused');
  if (counted.length === 0) return null;
  const score = counted.reduce((a, d) => a + (state.days[d] === 'present' ? 1 : state.days[d] === 'late' ? 0.5 : 0), 0);
  return Math.round((score / counted.length) * 100);
}

export function vacationsUsed(club: ClubConfig, state: MyClubState, month: string): number {
  if (club.rules.judge === 'week') return weeksOfMonth(month).filter((w) => state.weeks[w]?.vacation).length;
  return daysOfMonth(month).filter((d) => state.days[d] === 'excused').length;
}

export function weekTotal(state: MyClubState, monday: string): number {
  return weekDays(monday).reduce((a, d) => a + (state.minutes[d] ?? 0), 0);
}

/** 그 주의 목표 — 안 썼으면 가장 가까운 지난 주 목표를 이어 쓴다. 첫 주는 신청 때 쓴 값 */
export function goalOf(state: MyClubState, monday: string): { min: number; text?: string; carried: boolean } {
  const own = state.weeks[monday];
  if (own?.goalMin) return { min: own.goalMin, text: own.goalText, carried: false };
  const prev = Object.keys(state.weeks)
    .filter((w) => w < monday && state.weeks[w].goalMin)
    .sort()
    .pop();
  return {
    min: prev ? state.weeks[prev].goalMin! : state.appliedGoalMin,
    text: prev ? state.weeks[prev].goalText : undefined,
    carried: true,
  };
}

export type WeekVerdict = 'achieved' | 'missed' | 'vacation' | 'ongoing' | 'upcoming';

export function weekVerdict(state: MyClubState, monday: string, today: string): WeekVerdict {
  if (state.weeks[monday]?.vacation) return 'vacation';
  if (monday > today) return 'upcoming';
  if (addDays(monday, 6) >= today) return 'ongoing';
  return weekTotal(state, monday) >= goalOf(state, monday).min ? 'achieved' : 'missed';
}

/** 회고를 쓸 수 있는가 — 그 주 일요일부터 다음 주 월요일 끝까지. 내면 잠긴다 */
export function retroWindow(monday: string, today: string): 'before' | 'open' | 'closed' {
  const sunday = addDays(monday, 6);
  if (today < sunday) return 'before';
  if (today <= addDays(sunday, 1)) return 'open';
  return 'closed';
}

/* ── 시드 ─────────────────────────────────────────────────────────── */

const DAY_PATTERN: DayMark[] = [
  'present',
  'present',
  'present',
  'late',
  'present',
  'present',
  'present',
  'excused',
  'present',
  'present',
  'absent',
  'present',
  'present',
  'present',
  'late',
];
const MIN_PATTERN = [120, 90, 150, 60, 100, 80, 0, 110, 95, 130, 70, 140, 60, 45, 120];

export function seedMyClub(club: ClubConfig, today: string): MyClubState {
  const month = monthKey(today);
  // TODO(api): 신청서 답(「목표하는 나의 X 시간」)에서 읽는다. 프로토는 10시간
  const state: MyClubState = { days: {}, notes: {}, minutes: {}, weeks: {}, appliedGoalMin: 10 * 60 };
  if (club.rules.judge === 'day') {
    daysOfMonth(month)
      .filter((d) => d < today)
      .forEach((d, i) => (state.days[d] = DAY_PATTERN[i % DAY_PATTERN.length]));
    state.notes[addDays(today, -1)] = '6시 10분 기상 — 스트레칭까지';
    return state;
  }
  // 주 단위 — 이번 달 첫 주(12/7)부터. 12/1 ~ 12/6 은 11/30 주라 11월에 센다
  const firstMonday = mondayOf(`${month}-01`);
  for (let d = firstMonday, i = 0; d < today; d = addDays(d, 1), i++)
    state.minutes[d] = MIN_PATTERN[i % MIN_PATTERN.length];
  state.weeks[firstMonday] = {
    goalMin: 600,
    goalText: '알고리즘 강의 2개',
    retro: {
      good: '평일 저녁 루틴이 잡혔다. 주말엔 거의 못 했다',
      next: '토요일 오전 2시간 확보',
      at: addDays(firstMonday, 6),
    },
  };
  // 둘째 주(12/14)는 목표만 — 회고는 일요일 · 월요일 검토용으로 비워 둔다. 셋째 주(12/21) 목표는 안 써서 지난주를 이어 쓴다
  state.weeks[addDays(firstMonday, 7)] = { goalMin: 720, goalText: 'SQL 문제 30개' };
  return state;
}

/** 지난 달 결과 — 연속 완주를 센다 */
export function seedHistory(club: ClubConfig): MonthResult[] {
  const rate = club.rules.judge === 'week' ? [75, 100, 75] : [92, 88, 95];
  return [
    { month: '2026-09', result: 'completed', rate: rate[0] },
    { month: '2026-10', result: 'completed', rate: rate[1] },
    { month: '2026-11', result: 'completed', rate: rate[2] },
  ];
}

export function streakMonths(history: MonthResult[]): number {
  let n = 0;
  for (const h of [...history].sort((a, b) => (a.month < b.month ? 1 : -1))) {
    if (h.result !== 'completed') break;
    n++;
  }
  return n;
}

/* ── 화면 조립 — 클럽 설정에서 고른다 ─────────────────────────────────
 * 「내 클럽」은 칸(section)들의 목록이다. 어느 칸을 그릴지는 클럽 이름이 아니라 설정(`ClubRules`)에서 정한다.
 * 새 진행 방식이 생기면 칸 하나와 여기 규칙 한 줄을 더한다 — 다른 칸은 고치지 않는다.
 */
export type SectionKey = 'today' | 'calendar' | 'goal' | 'minutes' | 'retro' | 'weeks' | 'history';
export type StatKey = 'monthRate' | 'weekTotal' | 'weeksAchieved' | 'vacation' | 'streak';

type Rules = ClubConfig['rules'];

const SECTION_RULES: { key: SectionKey; when: (r: Rules) => boolean }[] = [
  { key: 'today', when: (r) => r.record === 'check' },
  { key: 'goal', when: (r) => r.weeklyGoal },
  { key: 'minutes', when: (r) => r.record === 'minutes' },
  { key: 'retro', when: (r) => r.retro === 'weekly' },
  { key: 'calendar', when: (r) => r.judge === 'day' },
  { key: 'weeks', when: (r) => r.judge === 'week' },
  { key: 'history', when: () => true },
];

const STAT_RULES: { key: StatKey; when: (r: Rules) => boolean }[] = [
  { key: 'monthRate', when: (r) => r.judge === 'day' },
  { key: 'weekTotal', when: (r) => r.judge === 'week' },
  { key: 'weeksAchieved', when: (r) => r.judge === 'week' },
  { key: 'vacation', when: () => true },
  { key: 'streak', when: () => true },
];

export function sectionsFor(rules: Rules): SectionKey[] {
  return SECTION_RULES.filter((x) => x.when(rules)).map((x) => x.key);
}
export function statsFor(rules: Rules): StatKey[] {
  return STAT_RULES.filter((x) => x.when(rules)).map((x) => x.key);
}
/** 휴가 · 판정의 단위 이름 */
export function unitOf(rules: Rules): string {
  return rules.judge === 'week' ? '주' : '일';
}
