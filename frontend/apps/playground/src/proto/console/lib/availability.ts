import type { Crew } from '@studyclub/types';
import { WEEKDAY_KEYS, type WeekdayKey } from '@studyclub/utils';

/**
 * 크루의 참여 가능 요일 · 프로필 시간대 — 프로토 더미.
 *
 * mock 크루에는 신청서의 `availableDays` 와 프로필 `timeZone` 이 없어서, 크루 id 로 고정된 값을 만든다 — 새로고침해도 같다.
 * TODO(api): GET /api/admin/studies/{studyId}/participants 의 participants[].availableDays · timeZone
 */

function seedOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** 평일 저녁형 · 주말형이 섞이게 — 한국은 주말 · 화목, 북미는 토 · 목이 많게 */
export function dummyDays(c: Crew): WeekdayKey[] {
  const h = seedOf(c.id);
  const weights = c.region === 'NA' ? [2, 2, 1, 4, 1, 5, 3] : [2, 4, 2, 4, 1, 5, 6];
  const picked = WEEKDAY_KEYS.filter((_, i) => ((h >> i) & 7) < weights[i]!);
  return picked.length > 0 ? picked : [WEEKDAY_KEYS[h % 7]!];
}

const NA_ZONES = ['America/Los_Angeles', 'America/New_York', 'America/Vancouver'] as const;

/** 북미는 서부 · 동부 · 밴쿠버로 나눈다. 기타 지역은 온보딩 전(시간대 없음)으로 둔다 — 셈에서 빠지는 경우를 보이려고 */
export function dummyTimeZone(c: Crew): string | null {
  if (c.region === 'KR') return 'Asia/Seoul';
  if (c.region === 'NA') return NA_ZONES[seedOf(c.id) % NA_ZONES.length]!;
  return null;
}
