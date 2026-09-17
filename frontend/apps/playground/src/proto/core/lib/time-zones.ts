import type { Locale } from './content';
import localizedLabels from './time-zone-labels.json';

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
  return `${zone} ${zoneLabel(zone, 'ko')} ${zoneLabel(zone, 'en')}`.replaceAll('_', ' ').toLocaleLowerCase();
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
  return [...new Set([...POPULAR_ZONES, ...(selected ? [selected] : []), ...supported, 'UTC'])];
}

export function zoneOffset(zone: string, now: Date): string {
  try {
    let formatter = offsetFormatters.get(zone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'longOffset' });
      offsetFormatters.set(zone, formatter);
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
      timeZone: zone,
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
