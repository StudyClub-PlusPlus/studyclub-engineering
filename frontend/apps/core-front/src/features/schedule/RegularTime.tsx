'use client';

import { HelpPopover } from '@studyclub/ui';
import { Info } from 'lucide-react';

import type { regularScheduleDisplay } from '@/features/schedule/regular-schedule';

export function RegularTime({ summary }: { summary: ReturnType<typeof regularScheduleDisplay> }) {
  return (
    <span className='inline-block'>
      {summary.label}{' '}
      <HelpPopover label='스터디 시간 기준 안내' icon={<Info />}>
        <span className='block font-semibold text-fg'>반 기준: {summary.original}</span>
        <span className='mt-1 block'>서머타임에 따라 내 지역의 시간이 달라질 수 있어요.</span>
      </HelpPopover>
    </span>
  );
}
