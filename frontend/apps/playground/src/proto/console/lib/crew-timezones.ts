import { isValidZone } from '@core/lib/schedule-timezone';
import { zoneLabel } from '@core/lib/time-zones';
import type { Crew } from '@studyclub/types';
import { readMemberTimeZones } from '@/proto/lib/member-timezone-store';

export function crewTimeZone(crew: Pick<Crew, 'email'> & { timeZone?: string | null }, members = readMemberTimeZones()): string | null {
  if (crew.timeZone !== undefined) return isValidZone(crew.timeZone) ? crew.timeZone : null;
  return members[crew.email.trim().toLowerCase()] ?? null;
}

export type ZoneCount = { key: string; count: number };
export const UNKNOWN_ZONE = 'unknown';
export function crewZoneLabel(zone: string) { return zone === UNKNOWN_ZONE ? '미설정' : zoneLabel(zone, 'ko'); }

export function countCrewTimeZones(people: (Pick<Crew, 'email'> & { timeZone?: string | null })[], members = readMemberTimeZones()): ZoneCount[] {
  const unique = new Map(people.map((person) => [person.email.trim().toLowerCase(), person]));
  const counts = new Map<string, number>();
  for (const person of unique.values()) {
    const zone = crewTimeZone(person, members) ?? UNKNOWN_ZONE;
    counts.set(zone, (counts.get(zone) ?? 0) + 1);
  }
  return [...counts].map(([key, count]) => ({ key, count }));
}

/** 회원이 한 명 이상 사용하는 유효한 시간대만 선택 후보로 제공한다. */
export function usedMemberTimeZones(people: (Pick<Crew, 'email'> & { timeZone?: string | null })[]): string[] {
  return countCrewTimeZones(people).filter(({ key, count }) => count > 0 && isValidZone(key)).map(({ key }) => key);
}

/** 최대 다섯 조각. 실제 누락 값이 들어오면 기타에 섞지 않고 따로 표시한다. */
export function groupTimeZones(data: ZoneCount[]) {
  const known = data.filter((d) => d.key !== UNKNOWN_ZONE && d.count > 0).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  const missing = data.find((d) => d.key === UNKNOWN_ZONE && d.count > 0);
  const capacity = 5 - (missing ? 1 : 0);
  const rest = known.length > capacity ? known.slice(capacity - 1) : [];
  const visible = rest.length ? [...known.slice(0, capacity - 1), { key: 'others', count: rest.reduce((sum, d) => sum + d.count, 0) }] : known;
  return { rows: missing ? [...visible, missing] : visible, rest };
}
