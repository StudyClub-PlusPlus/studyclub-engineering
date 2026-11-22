import type { Locale } from '@studyclub/types';

import { ONBOARDING_ZONES } from '@/features/onboarding/model';
import { usesVancouverPacificTime } from '@/lib/time-zone-rules';

const CITY: Record<string, { ko: string; en: string; symbol: string }> = {
  'Asia/Seoul': { ko: '서울', en: 'Seoul', symbol: 'KST' },
  'America/New_York': { ko: '뉴욕·토론토', en: 'New York · Toronto', symbol: 'ET' },
  'America/Toronto': { ko: '토론토', en: 'Toronto', symbol: 'ET' },
  'America/Vancouver': { ko: '밴쿠버', en: 'Vancouver', symbol: 'PCT' },
  'America/Los_Angeles': { ko: 'LA', en: 'LA', symbol: 'PT' },
};

export function isValidZone(zone?: string | null): zone is string {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** 프로필 → 브라우저 → 최종 기본값. 거주 권역으로 동부·서부를 추측하지 않는다. */
export function resolveDisplayZone(profile?: string | null, browser?: string | null): string {
  return isValidZone(profile) ? profile : isValidZone(browser) ? browser : 'Asia/Seoul';
}

/** 날짜 없는 선택 메뉴·화면 제목에는 ET/PT, 연중 UTC−7인 밴쿠버에는 PCT를 쓴다. */
export function zoneSymbol(zone: string): string {
  return (
    CITY[zone]?.symbol ??
    new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortGeneric' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName')?.value ??
    zone
  );
}

/** 날짜가 있는 회차에는 그 순간의 약칭을 쓴다. 밴쿠버는 LA와 독립적으로 계산한다. */
export function zoneAbbreviation(zone: string, at: Date): string {
  if (zone === 'Asia/Seoul') return 'KST';
  if (usesVancouverPacificTime(zone, at)) return 'PCT';
  return (
    new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value ?? zone
  );
}

export function scheduleZoneTitle(zone: string, locale: Locale = 'ko', at?: Date): string {
  const city = CITY[zone]?.[locale] ?? zone.split('/').at(-1)?.replaceAll('_', ' ') ?? zone;
  return `${city}(${at ? zoneAbbreviation(zone, at) : zoneSymbol(zone)})`;
}

export const SCHEDULE_ZONES = ONBOARDING_ZONES.map((zone) => ({
  iana: zone,
  label: scheduleZoneTitle(zone),
}));
