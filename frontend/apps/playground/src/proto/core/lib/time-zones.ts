import type { Locale } from './content';
import localizedLabels from './time-zone-labels.json';
import { formattingZone } from './time-zone-rules';

// Localized city/territory names from Unicode CLDR 48, with IANA 2025b aliases.
// See third-party/time-zone-labels.md for provenance and the Unicode license.
const LOCATIONS: Record<string, string[]> = localizedLabels;
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

export const POPULAR_ZONES = [
  'Asia/Seoul',
  'America/Toronto',
  'America/Vancouver',
  'America/New_York',
  'America/Los_Angeles',
];

export function zoneLabel(zone: string, locale: Locale): string {
  const label = LOCATIONS[zone]?.[locale === 'ko' ? 0 : 1];
  if (label) return label;
  // Browser/legacy aliases may not exist in the bundled label snapshot.
  try {
    const canonical = new Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone;
    const canonicalLabel = LOCATIONS[canonical]?.[locale === 'ko' ? 0 : 1];
    if (canonicalLabel) return canonicalLabel;
    return (
      new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
        timeZone: zone,
        timeZoneName: 'longGeneric',
      })
        .formatToParts(new Date())
        .find((part) => part.type === 'timeZoneName')?.value ?? (locale === 'ko' ? '기기 시간대' : 'Device time zone')
    );
  } catch {
    return locale === 'ko' ? '시간대를 다시 선택해 주세요' : 'Choose a time zone again';
  }
}

export function zoneSearchText(zone: string): string {
  const aliases: Record<string, string> = { 'America/Los_Angeles': 'LA 엘에이 로스엔젤레스', 'America/Vancouver': '밴쿠버' };
  return `${zone} ${zoneLabel(zone, 'ko')} ${zoneLabel(zone, 'en')} ${aliases[zone] ?? ''}`.replaceAll('_', ' ').toLocaleLowerCase();
}

export function availableZones(selected: string): string[] {
  let supported: string[] = [];
  try {
    supported = Intl.supportedValuesOf('timeZone');
  } catch {
    supported = Object.keys(LOCATIONS).filter((zone) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: zone });
        return true;
      } catch {
        return false;
      }
    });
  }
  try { if (selected) new Intl.DateTimeFormat('en', { timeZone: selected }); } catch { selected = ''; }
  return [...new Set([...POPULAR_ZONES, ...(selected ? [selected] : []), ...supported, 'UTC'])];
}

/** 회원 설정에서는 주요 이용 국가와 도시를 먼저, 나머지는 이름순으로 표시한다. */
export function memberTimeZones(selected: string, locale: Locale, allowedZones?: readonly string[]): string[] {
  const countries = ['한국', '미국', '캐나다', '오스트레일리아', '영국'];
  const preferredCities: Record<string, number> = {
    'America/New_York': 0,
    'America/Los_Angeles': 1,
    'America/Toronto': 0,
    'America/Vancouver': 1,
  };
  const collator = new Intl.Collator(locale === 'ko' ? 'ko-KR' : 'en-US');
  return [...new Set(allowedZones ?? availableZones(selected))]
    .map((zone) => {
      const country = zoneLabel(zone, 'ko').split(' · ')[0];
      const index = countries.indexOf(country);
      return { zone, rank: index < 0 ? countries.length : index, cityRank: preferredCities[zone] ?? 2, label: zoneLabel(zone, locale) };
    })
    .sort((a, b) => a.rank - b.rank || a.cityRank - b.cityRank || collator.compare(a.label, b.label) || a.zone.localeCompare(b.zone))
    .map(({ zone }) => zone);
}

export function zoneOffset(zone: string, now: Date): string {
  try {
    const effectiveZone = formattingZone(zone, now);
    let formatter = offsetFormatters.get(effectiveZone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat('en', { timeZone: effectiveZone, timeZoneName: 'longOffset' });
      offsetFormatters.set(effectiveZone, formatter);
    }
    return (
      formatter
        .formatToParts(now)
        .find((part) => part.type === 'timeZoneName')
        ?.value.replace('GMT', 'UTC') ?? ''
    );
  } catch {
    return '';
  }
}

export function localTime(zone: string, locale: Locale, now: Date): string {
  try {
    return new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
      timeZone: formattingZone(zone, now),
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'shortOffset',
    }).format(now);
  } catch {
    return '';
  }
}
