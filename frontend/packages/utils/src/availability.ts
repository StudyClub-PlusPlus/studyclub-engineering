/**
 * 참여 가능 요일 겹쳐 보기 — 신청자가 고른 요일을 기준 시간대의 「요일 × 시각」 칸으로 옮겨 센다.
 *
 * 신청 폼은 요일만 받는다(`FORM_ANSWER.availableDays`). 고른 요일은 **신청자 현지의 하루 전체**로 본다.
 * 그래서 PT 의 「월요일」은 KST 로 월 16시 ~ 화 16시에 걸친다. 칸마다 그 순간 신청자 현지 요일 · 시각을
 * 다시 계산해 세므로, 서머타임은 기준 주(이번 주)의 실제 날짜로 반영된다.
 */

export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export const WEEKDAY_LABELS_KO: Record<WeekdayKey, string> = {
  mon: '월',
  tue: '화',
  wed: '수',
  thu: '목',
  fri: '금',
  sat: '토',
  sun: '일',
};

/** 「현지 밤 빼기」 — 현지 0시 이상 이 시각 미만은 셈에서 뺀다. */
export const NIGHT_END_HOUR = 7;

/** 프로필 시간대가 없거나 읽을 수 없는 사람은 한국 시간으로 본다. */
export const DEFAULT_AVAILABILITY_ZONE = 'Asia/Seoul';

export type AvailabilityPerson<Id = string | number> = {
  id: Id;
  days: readonly string[];
  /** IANA 시간대. 없거나 읽을 수 없으면 {@link DEFAULT_AVAILABILITY_ZONE}(KST)로 본다. */
  timeZone: string | null;
};

export type OverlapCell<Id = string | number> = {
  /** 0 = 월 … 6 = 일 (기준 시간대) */
  day: number;
  /** 0 ~ 23 (기준 시간대) */
  hour: number;
  ids: Id[];
  /** 시간대(IANA) → 인원 */
  byZone: Record<string, number>;
};

export type AvailabilityOverlap<Id = string | number> = {
  /** `cells[day][hour]` */
  cells: OverlapCell<Id>[][];
  /** 한 칸의 최대 인원 — 진하기의 기준 */
  max: number;
  /** 셈에 든 사람 수 — 요일을 하나 이상 고른 사람 */
  counted: number;
  /** 기준 주의 월요일 (기준 시간대, yyyy-mm-dd) */
  weekStart: string;
};

/** 『월 · 수』 — 요일 키 순서대로. 모르는 키는 버린다. 없으면 빈 문자열. */
export function availableDaysText(days: readonly string[] | null | undefined): string {
  if (!days) return '';
  return WEEKDAY_KEYS.filter((k) => days.includes(k))
    .map((k) => WEEKDAY_LABELS_KO[k])
    .join(' · ');
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterOf(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    });
    formatters.set(zone, f);
  }
  return f;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

type ZonedParts = {
  y: number;
  m: number;
  d: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

function partsOf(zone: string, at: number): ZonedParts {
  const get: Record<string, string> = {};
  for (const p of formatterOf(zone).formatToParts(new Date(at))) get[p.type] = p.value;
  return {
    y: Number(get.year),
    m: Number(get.month),
    d: Number(get.day),
    hour: Number(get.hour) % 24,
    minute: Number(get.minute),
    second: Number(get.second),
    weekday: WEEKDAY_INDEX[get.weekday ?? ''] ?? 0,
  };
}

function offsetMs(zone: string, at: number): number {
  const p = partsOf(zone, at);
  return Date.UTC(p.y, p.m - 1, p.d, p.hour, p.minute, p.second) - Math.floor(at / 1000) * 1000;
}

/** 그 시간대의 벽시계 시각 → UTC 밀리초. 서머타임 경계에서 한 번 더 맞춘다. */
function zonedToUtc(zone: string, y: number, m: number, d: number, hour: number): number {
  const guess = Date.UTC(y, m - 1, d, hour);
  return guess - offsetMs(zone, guess - offsetMs(zone, guess));
}

export function isValidTimeZone(zone: string | null | undefined): zone is string {
  if (!zone) return false;
  try {
    formatterOf(zone);
    return true;
  } catch {
    return false;
  }
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function availabilityOverlap<Id extends string | number>(
  people: readonly AvailabilityPerson<Id>[],
  options: { baseZone: string; excludeNight: boolean; now?: Date },
): AvailabilityOverlap<Id> {
  const { baseZone, excludeNight } = options;
  const now = (options.now ?? new Date()).getTime();
  const today = partsOf(baseZone, now);
  const monday = new Date(Date.UTC(today.y, today.m - 1, today.d - today.weekday));

  const withDays = people.filter((p) => p.days.some((k) => (WEEKDAY_KEYS as readonly string[]).includes(k)));
  const zoned = withDays.map((p) => ({
    ...p,
    timeZone: isValidTimeZone(p.timeZone) ? p.timeZone : DEFAULT_AVAILABILITY_ZONE,
  }));
  const zones = [...new Set(zoned.map((p) => p.timeZone))];

  const cells: OverlapCell<Id>[][] = [];
  let max = 0;
  for (let day = 0; day < 7; day++) {
    const date = new Date(monday.getTime() + day * 86_400_000);
    const row: OverlapCell<Id>[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const at = zonedToUtc(baseZone, date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), hour);
      const local = new Map(zones.map((z) => [z, partsOf(z, at)]));
      const ids: Id[] = [];
      const byZone: Record<string, number> = {};
      for (const p of zoned) {
        const lp = local.get(p.timeZone)!;
        if (excludeNight && lp.hour < NIGHT_END_HOUR) continue;
        if (!p.days.includes(WEEKDAY_KEYS[lp.weekday]!)) continue;
        ids.push(p.id);
        byZone[p.timeZone] = (byZone[p.timeZone] ?? 0) + 1;
      }
      if (ids.length > max) max = ids.length;
      row.push({ day, hour, ids, byZone });
    }
    cells.push(row);
  }

  return {
    cells,
    max,
    counted: zoned.length,
    weekStart: ymd(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate()),
  };
}

export type BestSlot<Id = string | number> = {
  /** 0 = 월 … 6 = 일 (기준 시간대) */
  day: number;
  /** 같은 인원이 이어지는 첫 시각 */
  startHour: number;
  /** 같은 인원이 이어지는 마지막 시각 (포함) */
  endHour: number;
  /** 이 시각 내내 되는 사람 */
  ids: Id[];
};

/**
 * 「가장 많이 되는 시간」 — 요일마다 인원이 가장 많은 시각이 이어지는 가장 긴 구간을 하나 뽑고,
 * 인원이 많은 순(같으면 구간이 긴 순 · 이른 요일 순)으로 `limit` 개를 준다. 인원이 0 인 요일은 뺀다.
 * `hours` 에 든 시각만 본다(칸판에 보이는 줄).
 */
export function bestSlots<Id extends string | number>(
  overlap: AvailabilityOverlap<Id>,
  options: { hours: readonly number[]; limit: number },
): BestSlot<Id>[] {
  const hours = [...options.hours].sort((a, b) => a - b);
  const slots: BestSlot<Id>[] = [];
  overlap.cells.forEach((row, day) => {
    const top = Math.max(0, ...hours.map((h) => row[h]!.ids.length));
    if (top === 0) return;
    // 인원이 top 인 시각이 이어지는 구간 중 가장 긴 것 (같으면 이른 것)
    let run: { start: number; end: number } | null = null;
    let cur: { start: number; end: number } | null = null;
    for (const h of hours) {
      if (row[h]!.ids.length !== top) {
        cur = null;
        continue;
      }
      cur = cur && cur.end === h - 1 ? { start: cur.start, end: h } : { start: h, end: h };
      if (!run || cur.end - cur.start > run.end - run.start) run = cur;
    }
    if (!run) return;
    // 구간 내내 되는 사람 — 첫 칸의 사람 중 끝까지 남는 사람
    let ids = row[run.start]!.ids;
    for (let h = run.start + 1; h <= run.end; h++) {
      const here = new Set(row[h]!.ids);
      ids = ids.filter((id) => here.has(id));
    }
    slots.push({ day, startHour: run.start, endHour: run.end, ids });
  });
  return slots
    .sort((a, b) => b.ids.length - a.ids.length || b.endHour - b.startHour - (a.endHour - a.startHour) || a.day - b.day)
    .slice(0, options.limit);
}
