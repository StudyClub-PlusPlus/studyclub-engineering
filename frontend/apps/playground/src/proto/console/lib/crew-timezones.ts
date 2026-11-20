import { isValidZone } from '@core/lib/schedule-timezone';
import { zoneLabel } from '@core/lib/time-zones';
import type { Crew } from '@studyclub/types';

// Playground 전용 표본. 국가/지역으로 실제 회원의 시간대를 추정하지 않는다.
// 같은 이메일은 어느 스터디에서도 같은 회원 시간대를 갖는다.
const SAMPLE_ZONES = ['Asia/Seoul', 'Asia/Seoul', 'Asia/Seoul', 'America/Toronto', 'America/Toronto', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Kathmandu', 'Australia/Sydney', null];
export function crewTimeZone(crew: Pick<Crew, 'email'> & { timeZone?: string | null }): string | null {
  if (crew.timeZone !== undefined) return isValidZone(crew.timeZone) ? crew.timeZone : null;
  const hash = [...crew.email.toLowerCase()].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0, 0);
  return SAMPLE_ZONES[hash % SAMPLE_ZONES.length] ?? null;
}

export type ZoneCount = { key: string; count: number };
export const UNKNOWN_ZONE = 'unknown';
export function crewZoneLabel(zone: string) { return zone === UNKNOWN_ZONE ? '미설정' : zoneLabel(zone, 'ko'); }

export function countCrewTimeZones(people: (Pick<Crew, 'email'> & { timeZone?: string | null })[]): ZoneCount[] {
  const unique = new Map(people.map((person) => [person.email.trim().toLowerCase(), person]));
  const counts = new Map<string, number>();
  for (const person of unique.values()) {
    const zone = crewTimeZone(person) ?? UNKNOWN_ZONE;
    counts.set(zone, (counts.get(zone) ?? 0) + 1);
  }
  return [...counts].map(([key, count]) => ({ key, count }));
}

/** 최대 다섯 조각. 미설정은 Others에 섞지 않고 한 자리를 차지한다. */
export function groupTimeZones(data: ZoneCount[]) {
  const known = data.filter((d) => d.key !== UNKNOWN_ZONE && d.count > 0).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  const missing = data.find((d) => d.key === UNKNOWN_ZONE && d.count > 0);
  const capacity = 5 - (missing ? 1 : 0);
  const rest = known.length > capacity ? known.slice(capacity - 1) : [];
  const visible = rest.length ? [...known.slice(0, capacity - 1), { key: 'others', count: rest.reduce((sum, d) => sum + d.count, 0) }] : known;
  return { rows: missing ? [...visible, missing] : visible, rest };
}
