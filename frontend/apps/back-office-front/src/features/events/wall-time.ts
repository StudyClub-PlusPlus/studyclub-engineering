import { tzAbbr } from '@/features/schedule/time';

// 행사 일정 입력은 행사 기준 시간대의 현지 시각(`datetime-local`)이다. 서버는 UTC 한 순간만 받으므로
// 서머타임 판정(사라지는 시각 · 두 번 나오는 시각)은 화면이 한다.
// core-front `features/schedule/meetings.ts` 의 `resolveWallInput` 과 같은 계산이다.

function parts(instant: Date, zone: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instant)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

function offsetMs(instant: Date, zone: string): number {
  const { date, time } = parts(instant, zone);
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return Date.UTC(y, mo - 1, d, h, mi) - Math.floor(instant.getTime() / 60_000) * 60_000;
}

/** UTC 순간 → `datetime-local` 입력값(`2026-12-05T19:00`). 값이 없으면 빈 문자열. */
export function wallTime(iso: string | null | undefined, zone: string): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return '';
  const { date, time } = parts(new Date(iso), zone);
  return `${date}T${time}`;
}

export type WallTimeChoice = { iso: string; label: string };

/** 같은 현지 날짜·시각에 해당하는 모든 순간. 0개면 시계 전환으로 사라진 시각, 2개면 두 번 나오는 시각이다. */
export function wallTimeChoices(date: string, time: string, zone: string): WallTimeChoice[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return [];
  const guess = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(guess)) return [];
  const offsets = new Set([-2, -1, 0, 1, 2].map((day) => offsetMs(new Date(guess + day * 86_400_000), zone)));
  const instants = [...offsets]
    .map((offset) => new Date(guess - offset))
    .filter((at) => {
      const wall = parts(at, zone);
      return wall.date === date && wall.time === time;
    })
    .sort((a, b) => a.getTime() - b.getTime());
  return instants.map((at, index) => ({
    iso: at.toISOString(),
    label: `${time} · ${instants.length > 1 ? `시계 전환 ${index === 0 ? '전' : '후'} ` : ''}(${tzAbbr(zone, at)})`,
  }));
}

export type DateResolution = {
  /** 확정된 UTC 순간. 입력이 비었거나 아직 하나로 정해지지 않았으면 null */
  iso: string | null;
  choices: WallTimeChoice[];
  error?: string;
};

/**
 * 입력값 하나를 UTC 순간으로 확정한다.
 * - 저장돼 있던 값과 같은 현지 시각이면 **저장된 UTC 를 그대로** 쓴다 (수정하지 않은 일정은 유지)
 * - 두 번 나오는 시각은 `picked`(사용자가 고른 전·후)가 있어야 확정된다
 */
export function resolveDateField(
  value: string,
  zone: string,
  options: { savedIso?: string; pickedIso?: string } = {},
): DateResolution {
  if (!value) return { iso: null, choices: [] };
  const [date = '', time = ''] = value.split('T');
  const choices = wallTimeChoices(date, time, zone);
  if (choices.length === 0) {
    return {
      iso: null,
      choices,
      error: '올바른 날짜와 시각을 입력해 주세요. 시계 전환으로 사라지는 시각은 선택할 수 없어요.',
    };
  }
  for (const candidate of [options.pickedIso, options.savedIso]) {
    if (!candidate || !Number.isFinite(Date.parse(candidate))) continue;
    const wall = parts(new Date(candidate), zone);
    if (wall.date === date && wall.time === time) return { iso: candidate, choices };
  }
  if (choices.length > 1) {
    return { iso: null, choices, error: '같은 시각이 두 번 있어요. 시계 전환 전후 중 하나를 선택해 주세요.' };
  }
  return { iso: choices[0].iso, choices };
}
