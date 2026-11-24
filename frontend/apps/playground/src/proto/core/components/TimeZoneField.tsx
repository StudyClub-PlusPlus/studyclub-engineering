'use client';

import { useEffect, useMemo, useState } from 'react';

import type { Locale } from '@core/lib/content';
import { isValidZone } from '@core/lib/schedule-timezone';
import { availableZones, memberTimeZones, zoneLabel, zoneOffset, zoneSearchText } from '@core/lib/time-zones';
import { Button, TimeZonePicker } from '@studyclub/ui';

/** 회원·반·행사가 같은 검색 목록을 쓴다. 저장된 지역 ID와 별칭은 유지한다. */
export function zoneName(zone: string, locale: Locale): string | undefined {
  return isValidZone(zone) ? zoneLabel(zone, locale) : undefined;
}

/** UTC 차이는 서머타임 전환에 바뀐다 — 열어 둔 화면도 1분마다 다시 센다. */
function useMinute() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function TimeZoneField({
  value,
  onChange,
  locale,
  disabled,
  error,
  hideLabel,
  label,
  compact = false,
  size,
  required = true,
  annotation = '3',
  prioritizeCountries = false,
  allowedZones,
  allowWorldwide = false,
}: {
  value: string;
  onChange: (zone: string) => void;
  locale: Locale;
  disabled?: boolean;
  error?: string;
  hideLabel?: boolean;
  label?: string;
  compact?: boolean;
  /** compact 보다 우선. 제목 줄처럼 Button sm 과 높이를 맞출 때 'sm' */
  size?: 'sm' | 'md' | 'lg';
  required?: boolean;
  annotation?: string | false;
  prioritizeCountries?: boolean;
  /** 기본 후보 목록. allowWorldwide가 없으면 이 목록 밖의 지역은 표시하지 않는다. */
  allowedZones?: readonly string[];
  /** 기본 후보에서 전체 지역 검색으로 확장. 기존 선택값은 기본 목록에도 보존한다. */
  allowWorldwide?: boolean;
}) {
  const ko = locale === 'ko';
  const [worldwide, setWorldwide] = useState(false);
  const now = useMinute();
  const options = useMemo(() => {
    const candidates =
      allowWorldwide && worldwide
        ? undefined
        : allowWorldwide && allowedZones
          ? [...allowedZones, ...(isValidZone(value) ? [value] : [])]
          : allowedZones;
    const zones = prioritizeCountries
      ? memberTimeZones(value, locale, candidates)
      : [...new Set(candidates ?? availableZones(value))];
    return zones.map((zone) => {
      const [country, ...city] = zoneLabel(zone, locale).split(' · ');
      const grouped = prioritizeCountries && city.length > 0;
      return {
        value: zone,
        label: grouped ? city.join(' · ') : zoneLabel(zone, locale),
        selectedLabel: zoneLabel(zone, locale),
        group: prioritizeCountries ? (grouped ? country : ko ? '기타' : 'Other') : undefined,
        detail: zoneOffset(zone, now),
        keywords: zoneSearchText(zone),
      };
    });
  }, [value, locale, ko, prioritizeCountries, allowedZones, allowWorldwide, worldwide, now]);

  return (
    <TimeZonePicker
      value={value}
      onChange={onChange}
      options={options}
      locale={locale}
      label={label ?? (ko ? '나의 시간대' : 'My time zone')}
      hideLabel={hideLabel}
      required={required}
      disabled={disabled}
      error={error}
      size={size ?? (compact ? 'md' : 'lg')}
      searchable
      data-anno={annotation || undefined}
      onOpenChange={(open) => {
        if (open) setWorldwide(false);
      }}
      footer={
        allowWorldwide && (
          <Button size='sm' variant='tertiary' onClick={() => setWorldwide(!worldwide)}>
            {worldwide
              ? ko
                ? '회원이 있는 시간대만 보기'
                : 'Show member time zones'
              : ko
                ? '전체 시간대에서 찾기'
                : 'Search all time zones'}
          </Button>
        )
      }
    />
  );
}

export { ZONES } from '@core/lib/zones';
