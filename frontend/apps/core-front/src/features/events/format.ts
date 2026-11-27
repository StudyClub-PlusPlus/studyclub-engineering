import type { Locale } from '@studyclub/types';

import { zoneAbbreviation } from '@/features/schedule/timezone';

export function formatEventInstant(iso: string, timeZone: string, locale: Locale): string {
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return iso;
  const loc = locale === 'ko' ? 'ko-KR' : 'en-US';
  const formatted = new Intl.DateTimeFormat(loc, {
    timeZone,
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at);
  return `${formatted} ${zoneAbbreviation(timeZone, at)}`;
}