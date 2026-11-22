import type { ApiEventDetail } from '@/features/events/repository';

export function eventChannels(format: ApiEventDetail['format']): Array<'ONLINE' | 'OFFLINE'> {
  if (format === 'HYBRID') return ['ONLINE', 'OFFLINE'];
  return [format];
}

export const SCHEDULE_ZONES = [
  { value: 'Asia/Seoul', label: { ko: '한국 (서울)', en: 'Korea (Seoul)' } },
  { value: 'America/Toronto', label: { ko: '캐나다 (토론토)', en: 'Canada (Toronto)' } },
  { value: 'America/New_York', label: { ko: '미국 (뉴욕)', en: 'US (New York)' } },
  { value: 'America/Los_Angeles', label: { ko: '미국 (로스앤젤레스)', en: 'US (Los Angeles)' } },
] as const;