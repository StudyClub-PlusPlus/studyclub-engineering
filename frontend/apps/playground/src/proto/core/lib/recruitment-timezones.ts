import type { RecruitmentTimeZones, Study } from '@studyclub/types';

import type { Locale } from './content';
import { isValidZone } from './schedule-timezone';
import { memberTimeZones, zoneLabel } from './time-zones';

export function recruitmentTimeZones(study: Study): RecruitmentTimeZones {
  const saved = study.recruitmentTimeZones;
  if (saved) {
    if (saved.mode !== 'selected') return { mode: saved.mode, zones: [] };
    const zones = [...new Set(saved.zones.filter(isValidZone))];
    return { mode: zones.length ? 'selected' : 'unset', zones };
  }
  // 기존 동시 진행은 서울·LA이며, 전 세계 모집으로 바꾸지 않는다.
  const zones = study.timezone === 'both' ? ['Asia/Seoul', 'America/Los_Angeles']
    : study.timezone === 'KST' ? ['Asia/Seoul'] : study.timezone === 'PST' ? ['America/Los_Angeles'] : [];
  return { mode: zones.length ? 'selected' : 'unset', zones };
}

/** 모집 안내·목록 필터에서 쓰는 짧은 지역명. 저장하는 IANA ID는 유지한다. */
export function recruitmentLocationLabel(zone: string, locale: Locale): string {
  if (locale === 'ko' && zone === 'Asia/Seoul') return '한국';
  if (locale === 'ko' && zone === 'America/Los_Angeles') return '미국 · LA';
  return zoneLabel(zone, locale);
}

export function recruitmentZoneLabel(study: Study, locale: Locale): string {
  const value = recruitmentTimeZones(study);
  if (value.mode === 'all') return locale === 'ko' ? '모든 시간대에서 모집' : 'Open to all time zones';
  if (value.mode === 'unset' || !value.zones.length) return locale === 'ko' ? '미정' : 'TBD';
  return memberTimeZones('', locale, value.zones).map((zone) => recruitmentLocationLabel(zone, locale)).join(' / ');
}

export function matchesRecruitmentZone(study: Study, zone: string): boolean {
  if (zone === 'all') return true;
  const value = recruitmentTimeZones(study);
  return value.mode === 'all' || value.mode === 'unset' || (value.mode === 'selected' && value.zones.includes(zone));
}

export function recruitmentZoneOptions(studies: Study[], locale: Locale): string[] {
  return memberTimeZones('', locale, studies.flatMap((study) => {
    const value = recruitmentTimeZones(study);
    return value.mode === 'selected' ? value.zones : [];
  }));
}
