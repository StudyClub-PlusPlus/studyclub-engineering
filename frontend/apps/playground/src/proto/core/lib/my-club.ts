import type { ClubConfig, ClubRules } from '@console/lib/clubs';

/**
 * 「내 클럽」 — 크루가 자기 클럽에서 매일 쓰는 화면의 데이터와 계산.
 *
 * 세 클럽의 실제 운영(시트 · 디스코드)을 따른다.
 * - 얼리버드: 날마다 「했다」, 지각은 0.5일. 앞에 보이는 숫자는 이번 달 출석률
 * - Daily LeetCode: 기록을 자동으로 받는다. 앞에 보이는 숫자는 연속일(스트릭) — 달이 바뀌어도 이어진다
 * - WEEKLY X: 날마다 공부 시간, 주마다 목표 시간 · 한 줄. 앞에 보이는 숫자는 주 달성률(%) — 합격선 없음, 목표 0 은 쉬는 주
 * 어느 쪽인지는 클럽 설정(`ClubConfig.rules`)이 정한다 — 클럽 이름으로 나누지 않는다.
 *
 * 날짜는 시간대 없는 그날이다 (POL-0012). 주는 월요일 ~ 일요일이고 해 기준 주차(ISO)로 부른다.
 *
 * TODO(api): GET /api/clubs/{programId}/me — 멤버 · 쉬는 기간 · 최근 기록 · 주 기록 · 지난 달 결과
 */

export type DayMark = 'present' | 'late' | 'absent' | 'excused';

export type WeekEntry = {
  /** 목표 시간(분). 0 이면 쉬는 주. 비어 있으면 지난 목표를 이어 쓴다 */
  goalMin?: number;
  /** 이번 주 한 줄 — 다짐 · 회고 · 사정 무엇이든 (선택) */
  note?: string;
};

/** 멤버 상태 — 쉬는 중이어도 멤버로 남는다. 쉬는 기간이 끝나면 돌아온다 */
export type Membership = { kind: 'active' } | { kind: 'resting'; until: string };

export type MyClubState = {
  /** 날 단위 기록 — YYYY-MM-DD → 값. 없으면 안 한 날 */
  days: Record<string, DayMark>;
  /** 인증에 남긴 메모 한 줄 */
  notes: Record<string, string>;
  /** 주 단위 — 그날 공부 시간(분) */
  minutes: Record<string, number>;
  /** 주 단위 — 그 주 월요일 → 목표 · 한 줄 */
  weeks: Record<string, WeekEntry>;
  /** 주 단위 — 신청 때 쓴 목표(분). 처음 목표의 기본값 */
  appliedGoalMin: number;
  /** 스트릭 — 기록이 있는 첫날 전날까지 이어 온 연속일 (달을 넘어 이어진다) */
  streakBefore: number;
  membership: Membership;
  /** 크루가 「다음 달 쉬기」를 눌렀나 */
  restNextMonth: boolean;
  /** 날짜 → 캡틴이 고친 기록. 없으면 클럽의 인증 출처(크루 · 자동)가 남긴 것 */
  byCaptain?: Record<string, true>;
};

export type MonthResult = { month: string; result: 'completed' | 'rested' | 'withdrawn'; rate?: number };

/** 검토용 「오늘」 — 평일(수) · 일요일 · 목표를 쓰는 월요일 */
export type DemoDay = 'wed' | 'sun' | 'mon';
export const DEMO_DAYS: Record<DemoDay, string> = { wed: '2026-12-16', sun: '2026-12-20', mon: '2026-12-21' };
export const DEMO_LABEL: Record<DemoDay, string> = { wed: '12/16(수)', sun: '12/20(일)', mon: '12/21(월)' };

/* ── 날짜 ─────────────────────────────────────────────────────────── */

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
export function nextMonthKey(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}
export function monthLabel(month: string): string {
  return `${Number(month.slice(5))}월`;
}
export function daysOfMonth(month: string): string[] {
  const out: string[] = [];
  for (let d = `${month}-01`; monthKey(d) === month; d = addDays(d, 1)) out.push(d);
  return out;
}
/** 해 기준 주차 (ISO 8601) — WEEKLY X 시트의 「46주차」 */
export function isoWeek(monday: string): number {
  const thursday = parse(addDays(monday, 3));
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - jan1) / 86_400_000 / 7) + 1;
}
/** 이번 주를 포함한 최근 n 주의 월요일 — 최근 것이 앞 */
export function recentWeeks(today: string, n: number): string[] {
  const m = mondayOf(today);
  return Array.from({ length: n }, (_, i) => addDays(m, -7 * i));
}

/** 「2시간 30분」 · 「45분」 · 「0분」 */
export function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}시간 ${m}분`;
  if (h) return `${h}시간`;
  return `${m}분`;
}

/* ── 날 단위 ─────────────────────────────────────────────────────── */

/** 이 클럽에서 크루가 보는 기록 값 — 설정에서 고른다 */
export function marksFor(rules: ClubRules): DayMark[] {
  return ['present', ...(rules.allowsLate ? (['late'] as const) : []), ...(rules.dayOff ? (['excused'] as const) : [])];
}

/**
 * 이번 달 출석률 — 출석 1 · 지각 0.5 · 안 한 날 0. 휴가는 분모에서 뺀다.
 * 오늘은 기록이 있을 때만 센다 (아직 하루가 남았다).
 */
export function dayRate(state: MyClubState, month: string, today: string): number | null {
  const counted = daysOfMonth(month).filter(
    (d) => (d < today || (d === today && state.days[d])) && state.days[d] !== 'excused',
  );
  if (counted.length === 0) return null;
  const score = counted.reduce((a, d) => a + (state.days[d] === 'present' ? 1 : state.days[d] === 'late' ? 0.5 : 0), 0);
  return Math.round((score / counted.length) * 100);
}

export function dayOffUsed(state: MyClubState, month: string): number {
  return daysOfMonth(month).filter((d) => state.days[d] === 'excused').length;
}

/** 이번 달에 한 날 */
export function doneDays(state: MyClubState, month: string): number {
  return daysOfMonth(month).filter((d) => state.days[d] === 'present' || state.days[d] === 'late').length;
}

/**
 * 연속일 — 오늘 했으면 오늘부터, 아니면 어제부터 거꾸로 센다. 빠진 날에서 끊긴다.
 * 기록이 있는 첫날까지 이어지면 그 전 스트릭(`streakBefore`)을 더한다 — 달이 바뀌어도 이어진다.
 */
export function currentStreak(state: MyClubState, today: string): number {
  const first = Object.keys(state.days).sort()[0];
  let d = state.days[today] ? today : addDays(today, -1);
  let n = 0;
  while (first && d >= first) {
    if (!state.days[d]) return n;
    n++;
    d = addDays(d, -1);
  }
  return n + state.streakBefore;
}

/* ── 주 단위 ─────────────────────────────────────────────────────── */

export function weekTotal(state: MyClubState, monday: string): number {
  return weekDays(monday).reduce((a, d) => a + (state.minutes[d] ?? 0), 0);
}

/**
 * 그 주의 목표 — 그 주에 쓴 값(0 이면 쉬는 주). 안 썼으면 가장 가까운 지난 목표(쉬는 주 0 은 건너뛴다)를 이어 쓴다.
 * 처음은 신청 때 쓴 값.
 */
export function goalOf(state: MyClubState, monday: string): { min: number; carried: boolean } {
  const own = state.weeks[monday]?.goalMin;
  if (own !== undefined) return { min: own, carried: false };
  const prev = Object.keys(state.weeks)
    .filter((w) => w < monday && (state.weeks[w].goalMin ?? 0) > 0)
    .sort()
    .pop();
  return { min: prev ? state.weeks[prev].goalMin! : state.appliedGoalMin, carried: true };
}

/** 주 달성률(%) — 합계 ÷ 목표. 100 을 넘을 수 있다. 쉬는 주(목표 0)는 null. 합격선은 없다 */
export function weekPercent(state: MyClubState, monday: string): number | null {
  const goal = goalOf(state, monday).min;
  if (goal === 0) return null;
  return Math.round((weekTotal(state, monday) / goal) * 1000) / 10;
}

/** 끝난 주들의 평균 달성률 — 쉬는 주는 뺀다 */
export function averagePercent(state: MyClubState, mondays: string[]): number | null {
  const xs = mondays.map((w) => weekPercent(state, w)).filter((x): x is number => x !== null);
  if (xs.length === 0) return null;
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
}

/* ── 달 ─────────────────────────────────────────────────────────── */

/** 연속 완주 — 쉰 달은 세지도 끊지도 않는다. 중단에서 끊긴다 */
export function streakMonths(history: MonthResult[]): number {
  let n = 0;
  for (const h of [...history].sort((a, b) => (a.month < b.month ? 1 : -1))) {
    if (h.result === 'withdrawn') break;
    if (h.result === 'completed') n++;
  }
  return n;
}

/* ── 시드 ─────────────────────────────────────────────────────────── */

const EARLY_PATTERN: (DayMark | undefined)[] = [
  'present',
  'present',
  'late',
  'present',
  'present',
  undefined,
  'present',
  'excused',
  'present',
  'late',
  'present',
  undefined,
  'present',
  'present',
  'present',
];
const MIN_PATTERN = [120, 90, 150, 60, 100, 80, 0, 110, 95, 130, 70, 140, 60, 45, 120, 75, 0];

/** 기록을 남긴 사람 — 크루 직접 · 외부 자동 · 캡틴이 고침. 출석부 칸에 표시한다 */
export type RecordSource = 'crew' | 'auto' | 'captain';

/**
 * 멤버 한 사람의 시드. `variant` 로 사람마다 기록을 조금씩 다르게 한다 — 0 이 「나」.
 * variant 4 는 며칠째 기록이 없는 사람(캡틴의 「살펴볼 사람」 예시).
 */
export function seedMyClub(club: ClubConfig, today: string, membership: Membership, variant = 0): MyClubState {
  const month = monthKey(today);
  const state: MyClubState = {
    days: {},
    notes: {},
    minutes: {},
    weeks: {},
    // TODO(api): 신청서 답(「목표하는 나의 X 시간」)에서 읽는다
    appliedGoalMin: (10 + (variant % 3) * 5) * 60,
    streakBefore: 0,
    membership,
    restNextMonth: variant === 3,
  };
  if (membership.kind === 'resting') return state;
  const r = club.rules;
  // 며칠째 기록이 없는 사람 — 사흘 전까지만 기록이 있다
  const until = variant === 4 ? addDays(today, -3) : today;
  if (r.judge === 'day' && r.metric === 'streak') {
    // 자동 기록 — 사람마다 한 번씩 빠진 날이 있어 스트릭이 다시 시작됐다
    const miss = 5 + ((variant * 4) % 9);
    daysOfMonth(month)
      .filter((d) => d < until && Number(d.slice(8)) !== miss)
      .forEach((d) => (state.days[d] = 'present'));
    return state;
  }
  if (r.judge === 'day') {
    daysOfMonth(month)
      .filter((d) => d < until)
      .forEach((d, i) => {
        const v = EARLY_PATTERN[(i + variant * 4) % EARLY_PATTERN.length];
        if (v && marksFor(r).includes(v)) state.days[d] = v;
      });
    if (variant === 0) state.notes[addDays(today, -1)] = '6시 10분 기상 — 스트레칭까지';
    return state;
  }
  // 주 단위 — 최근 6주. 한 주는 쉬는 주(목표 0), 이번 주는 목표를 안 써서 지난 목표를 이어 쓴다
  const scale = state.appliedGoalMin / 600;
  const weeks = recentWeeks(today, 6).reverse();
  for (let d = weeks[0], i = 0; d < until; d = addDays(d, 1), i++)
    state.minutes[d] = Math.round((MIN_PATTERN[(i + variant * 5) % MIN_PATTERN.length] * scale) / 5) * 5;
  const g = (min: number) => Math.round(min * scale);
  state.weeks[weeks[0]] = { goalMin: g(600), note: variant === 0 ? '알고리즘 강의 2개' : undefined };
  state.weeks[weeks[1]] = {
    goalMin: variant % 2 === 0 ? 0 : g(600),
    note: variant === 0 ? '출장 주간 — 쉽니다' : undefined,
  };
  if (variant % 2 === 0) weekDays(weeks[1]).forEach((d) => delete state.minutes[d]);
  state.weeks[weeks[2]] = { goalMin: g(600) };
  state.weeks[weeks[3]] = { goalMin: g(720), note: ['공부 방식을 바꾸는 주간', '루틴 만들기', undefined][variant % 3] };
  state.weeks[weeks[4]] = { goalMin: g(720), note: ['SQL 문제 30개', undefined, '시간 조금 늘려 보기'][variant % 3] };
  return state;
}

/** 지난 달 결과 — 10월은 쉰 달 */
export function seedHistory(club: ClubConfig): MonthResult[] {
  const rate = club.rules.metric === 'weekPercent' ? [92.5, 104.3] : [92, 95];
  return [
    { month: '2026-09', result: 'completed', rate: rate[0] },
    { month: '2026-10', result: 'rested' },
    { month: '2026-11', result: 'completed', rate: rate[1] },
  ];
}

/* ── 화면 조립 — 클럽 설정에서 고른다 ─────────────────────────────────
 * 「내 클럽」은 칸(section)들의 목록이다. 어느 칸을 그릴지는 클럽 이름이 아니라 설정(`ClubRules`)과 멤버 상태에서 정한다.
 * 새 진행 방식이 생기면 칸 하나와 여기 규칙 한 줄을 더한다 — 다른 칸은 고치지 않는다.
 */
export type SectionKey =
  'resting' | 'today' | 'auto' | 'calendar' | 'goal' | 'minutes' | 'note' | 'weeks' | 'membership' | 'history';
export type StatKey = 'monthRate' | 'dayOff' | 'streak' | 'monthDone' | 'weekNow' | 'lastWeek' | 'average' | 'months';

type Rule<K> = { key: K; when: (r: ClubRules) => boolean };

const SECTION_RULES: Rule<SectionKey>[] = [
  { key: 'today', when: (r) => r.record === 'check' && r.source === 'crew' },
  { key: 'auto', when: (r) => r.source === 'auto' },
  { key: 'goal', when: (r) => r.weeklyGoal },
  { key: 'minutes', when: (r) => r.record === 'minutes' },
  { key: 'note', when: (r) => r.weeklyNote },
  { key: 'calendar', when: (r) => r.judge === 'day' },
  { key: 'weeks', when: (r) => r.judge === 'week' },
  { key: 'membership', when: () => true },
  { key: 'history', when: () => true },
];

const STAT_RULES: Rule<StatKey>[] = [
  { key: 'monthRate', when: (r) => r.metric === 'rate' },
  { key: 'streak', when: (r) => r.metric === 'streak' },
  { key: 'monthDone', when: (r) => r.metric === 'streak' },
  { key: 'weekNow', when: (r) => r.metric === 'weekPercent' },
  { key: 'lastWeek', when: (r) => r.metric === 'weekPercent' },
  { key: 'average', when: (r) => r.metric === 'weekPercent' },
  { key: 'dayOff', when: (r) => r.dayOff },
  { key: 'months', when: () => true },
];

export function sectionsFor(rules: ClubRules, membership: Membership): SectionKey[] {
  // 쉬는 중에는 기록 칸을 닫고 쉬는 안내 · 지난 달만 보인다
  if (membership.kind === 'resting') return ['resting', 'history'];
  return SECTION_RULES.filter((x) => x.when(rules)).map((x) => x.key);
}
export function statsFor(rules: ClubRules): StatKey[] {
  return STAT_RULES.filter((x) => x.when(rules)).map((x) => x.key);
}
