/**
 * 회차 일자·시각과 시간대.
 *
 * 저장값은 서버와 같이 UTC 예정 시각(`scheduledAt`) 하나다. 화면의 일자·시각은 반 시간대(또는 표에서 고른 시간대)로
 * 바꿔 계산한 값이다. 약어(PST/PDT)는 값으로 쓰지 않는다 — 서머타임 전환 주에 한 시간이 어긋난다. 저장은 지역 ID 로.
 *
 * playground `proto/core/lib/meetings.ts` · `proto/console/lib/schedule.ts` 와 같은 계산이다.
 */

/** 반이 도는 시간대. 모이는 권역이 한국과 미국 서부 둘뿐이다. */
export type StudyTz = 'Asia/Seoul' | 'America/Los_Angeles';

export const STUDY_TZS: { key: StudyTz; label: string }[] = [
  { key: 'Asia/Seoul', label: '한국' },
  { key: 'America/Los_Angeles', label: '미국 서부' },
];

/** 일정 표에서 고를 수 있는 시간대. 표의 일자·시각은 고른 시간대로 보이고 그 시간대로 고친다. */
export const DISPLAY_ZONES = [
  { iana: 'Asia/Seoul', label: 'KST', name: '한국 시간' },
  { iana: 'America/Los_Angeles', label: 'PDT', name: '미국 서부 시간' },
] as const;

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
export const DOW_LABEL = DOW;

/** 그 시간대에서 본 순간의 벽시계 부품. */
function zonedParts(instant: Date, iana: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: iana,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute };
}

/** 그 순간 시간대의 UTC 오프셋(ms). 서머타임이 있으면 날짜마다 다르다. */
function offsetMs(instant: Date, iana: string): number {
  const p = zonedParts(instant, iana);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return asUtc - Math.floor(instant.getTime() / 60_000) * 60_000;
}

/** 시간대의 벽시계(일자 `yyyy-MM-dd` · 시각 `HH:mm`) → 순간(UTC). 서버에 보낼 값이다. */
export function zonedInstant(date: string, time: string, iana: string): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // 오프셋을 한 번 더 잰다 — 서머타임 경계를 넘는 날도 맞추기 위해.
  const first = guess - offsetMs(new Date(guess), iana);
  return new Date(guess - offsetMs(new Date(first), iana));
}

/** 순간(UTC) → 그 시간대의 일자·시각. 화면에 보이는 값이다. */
export function wallParts(instant: Date, iana: string): { date: string; time: string } {
  const p = zonedParts(instant, iana);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** `2026-09-30 20:30` — 고른 시간대의 벽시계로. 미리보기의 일정 형식. */
export function scheduleLabel(instant: Date, iana: string): string {
  const { date, time } = wallParts(instant, iana);
  return `${date} ${time}`;
}

/** 시간대 약칭. 미국 서부는 그날 기준으로 PDT(−7) · PST(−8). */
export function tzAbbr(iana: string, at = new Date()): string {
  if (iana === 'Asia/Seoul') return 'KST';
  if (iana === 'America/Los_Angeles') return offsetMs(at, iana) === -7 * 3_600_000 ? 'PDT' : 'PST';
  return iana;
}

/** 표 머리·칸 이름의 시간대 약칭. 시간대 탭과 같은 글자를 쓴다. */
export function zoneLabel(iana: string): string {
  return DISPLAY_ZONES.find((z) => z.iana === iana)?.label ?? tzAbbr(iana);
}

/** 「한국 시간(KST)」 — 회차 추가 창 머리의 기준 시간대. */
export function zoneTitle(iana: string): string {
  const name = DISPLAY_ZONES.find((z) => z.iana === iana)?.name ?? iana;
  return `${name}(${zoneLabel(iana)})`;
}

export function dowOf(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** `9/30(수)` */
export function dayLabel(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number);
  return `${m}/${d}(${DOW[dowOf(ymd)]})`;
}

/** `2026-09-23 (수)` — 일정 표 일자 칸. */
export function dateWithDow(ymd: string): string {
  return ymd ? `${ymd} (${DOW[dowOf(ymd)]})` : '';
}

export function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 같은 순간을 다른 시간대의 벽시계로 — 「수 05:00 PDT」. */
function clockIn(at: Date, iana: string): string {
  const { date, time } = wallParts(at, iana);
  return `${DOW[dowOf(date)]} ${time} ${tzAbbr(iana, at)}`;
}

/** 다른 시간대에서는 몇 시인가. 요일까지 적는다 — 목 21:00 KST 는 미국에서 수요일이다. */
export function otherClock(weekdays: number[], time: string, tz: StudyTz, today = new Date()): string | undefined {
  if (!time || weekdays.length === 0) return undefined;
  const other: StudyTz = tz === 'Asia/Seoul' ? 'America/Los_Angeles' : 'Asia/Seoul';
  // 기간이 없으니 오늘 이후 첫 그 요일로 환산한다
  let sample = wallParts(today, tz).date;
  while (dowOf(sample) !== weekdays[0]) sample = addDaysYmd(sample, 1);
  return clockIn(zonedInstant(sample, time, tz), other);
}
