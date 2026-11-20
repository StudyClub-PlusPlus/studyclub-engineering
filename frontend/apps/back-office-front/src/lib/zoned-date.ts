/**
 * ISO 타임스탬프를 주어진 시간대의 `yyyy-mm-dd` 로 변환한다.
 * 날짜만 있는 값(`2026-10-15`)은 그대로 반환한다.
 * 파싱 실패 시 undefined.
 *
 * POL-0006: 날짜 표시는 프로필 → 브라우저 → 서울 순서의 시간대로 한다.
 * 이 함수는 시간대를 직접 받으므로 호출 측이 `useDisplayTimeZone()` 결과를 넘긴다.
 */
export function zonedDate(raw: string | undefined | null, tz: string): string | undefined {
  if (!raw) return undefined;
  if (!/T/.test(raw)) return raw.slice(0, 10); // 이미 날짜만 있는 값
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return undefined;
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(at);
}

/**
 * `yyyy-mm-dd` 날짜를 주어진 시간대의 자정(00:00:00)으로 UTC ISO 로 변환한다.
 * 서버로 보낼 때 쓴다 — 스터디 시작일처럼 "그 지역의 하루 시작"을 뜻하는 날짜에 사용.
 */
export function zonedMidnightIso(date: string, tz: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  // 첫 추정: UTC 자정 기준으로 오프셋 계산
  const guess = Date.UTC(y, mo - 1, d, 0, 0);
  const offset = getOffsetMs(new Date(guess), tz);
  const first = new Date(guess - offset);
  // 서머타임 경계를 한 번 더 보정
  const offset2 = getOffsetMs(first, tz);
  return new Date(guess - offset2).toISOString();
}

/**
 * `yyyy-mm-dd` 날짜를 주어진 시간대의 23:59:59 로 UTC ISO 로 변환한다.
 * 모집 마감일처럼 "그날 끝까지"를 뜻하는 날짜에 사용.
 */
export function zonedEndOfDayIso(date: string, tz: string): string {
  const [y, mo, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, 23, 59, 59);
  const offset = getOffsetMs(new Date(guess), tz);
  const first = new Date(guess - offset);
  const offset2 = getOffsetMs(first, tz);
  return new Date(guess - offset2).toISOString();
}

/** 주어진 순간의 시간대 UTC 오프셋(ms). 서머타임이 있으면 날짜마다 다르다. */
function getOffsetMs(instant: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour,
    +parts.minute,
    +parts.second,
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}
