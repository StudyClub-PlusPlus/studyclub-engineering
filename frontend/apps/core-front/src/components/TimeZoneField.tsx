'use client';

import { useEffect, useMemo, useState } from 'react';

import type { Locale } from '@studyclub/types';
import { TimeZonePicker } from '@studyclub/ui';

import { zoneOffset } from '@/features/onboarding/model';

const ZONES = [
  { zone: 'Asia/Seoul', ko: '한국 · 서울', en: 'Korea · Seoul' },
  {
    zone: 'America/New_York',
    ko: '북미 동부 · 뉴욕, 토론토',
    en: 'North America East · New York, Toronto',
  },
  {
    zone: 'America/Vancouver',
    ko: '북미 서부 · 밴쿠버',
    en: 'North America West · Vancouver',
  },
  {
    zone: 'America/Los_Angeles',
    ko: '북미 서부 · LA',
    en: 'North America West · LA',
  },
] as const;

/** 고른 지역의 이름. 목록에 없는 값이면 비운다. */
export function zoneName(zone: string, locale: Locale): string | undefined {
  const found = ZONES.find((z) => z.zone === zone);
  return found ? (locale === 'ko' ? found.ko : found.en) : undefined;
}

/** 회원의 시간대 — 가입 · 프로필에서 고르는 네 지역. */
export function TimeZoneField({
  value,
  onChange,
  locale,
  disabled,
  error,
  hideLabel,
}: {
  value: string;
  onChange: (zone: string) => void;
  locale: Locale;
  disabled?: boolean;
  error?: string;
  /** 이미 라벨이 있는 자리(카드 칸 안)에서는 제 라벨을 숨긴다 — 같은 말이 두 번 나온다. */
  hideLabel?: boolean;
}) {
  const ko = locale === 'ko';
  // UTC 차이는 서머타임 전환에 바뀐다 — 열어 둔 화면도 1분마다 다시 센다.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const options = useMemo(
    () => ZONES.map((z) => ({ value: z.zone, label: ko ? z.ko : z.en, detail: zoneOffset(z.zone, now) })),
    [ko, now],
  );
  return (
    <TimeZonePicker
      value={value}
      onChange={onChange}
      options={options}
      locale={locale}
      label={ko ? '나의 시간대' : 'My time zone'}
      required
      hideLabel={hideLabel}
      placeholder={ko ? '지역을 선택해 주세요' : 'Select your region'}
      disabled={disabled}
      error={error}
    />
  );
}
