import type { BadgeTone } from '@studyclub/ui';

import type { EventListItem } from '@/features/events/types';
import { wallTime } from '@/features/events/wall-time';
import { tzAbbr } from '@/features/schedule/time';

/** 「2026-12-05 19:00 KST」. 시간대 약어는 그 날짜의 값이라 서머타임 전환 전후가 다르게 나온다. */
export function formatInstant(iso: string | null | undefined, zone: string): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return '';
  return `${wallTime(iso, zone).replace('T', ' ')} ${tzAbbr(zone, new Date(iso))}`;
}

export const DISPLAY_STATUS_TONE: Record<EventListItem['displayStatus'], BadgeTone> = {
  RECRUITING: 'recruiting',
  FULL: 'closingsoon',
  RECRUITMENT_CLOSED: 'closed',
  ENDED: 'ended',
  CANCELLED: 'error',
};
