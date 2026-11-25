import { getTimeZone } from '@core/lib/me';
import { wallParts } from '@core/lib/meetings';
import { isValidZone, zoneAbbreviation } from '@core/lib/schedule-timezone';

import { getUser } from './auth';

export const CONSOLE_TIME_ZONE_EVENT = 'bo:timezone-change';
export function consoleTimeZoneKey(userId: number | null) {
  return `bo_display_timezone:${userId ?? 'preview'}`;
}
export function getConsoleTimeZone() {
  if (typeof window === 'undefined') return 'Asia/Seoul';
  try {
    const saved = window.localStorage.getItem(consoleTimeZoneKey(getUser()?.id ?? null));
    if (saved && isValidZone(saved)) return saved;
  } catch { /* 저장소가 막혀 있으면 프로필·기기 기본값 사용 */ }
  return getTimeZone();
}
export function setConsoleTimeZone(zone: string) {
  if (!isValidZone(zone)) return;
  window.localStorage.setItem(consoleTimeZoneKey(getUser()?.id ?? null), zone);
  window.dispatchEvent(new Event(CONSOLE_TIME_ZONE_EVENT));
}
export function subscribeConsoleTimeZone(onChange: () => void) {
  const events = ['storage', CONSOLE_TIME_ZONE_EVENT, 'bo:session-change', 'sc:timezone-change'];
  events.forEach((event) => window.addEventListener(event, onChange));
  return () => events.forEach((event) => window.removeEventListener(event, onChange));
}

/** 날짜가 있는 기록은 그 날짜의 DST 약칭을 붙인다. 읽을 수 없는 원문은 보존한다. */
export function formatConsoleTimestamp(iso: string, zone: string) {
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return iso;
  const wall = wallParts(at, zone);
  return `${wall.date} ${wall.time} ${zoneAbbreviation(zone, at)}`;
}
