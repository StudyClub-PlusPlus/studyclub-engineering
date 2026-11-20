'use client';

import { STUDY_TZS, tzAbbr } from '@/features/schedule/time';
import { useDisplayTimeZone } from '@/lib/use-display-timezone';

/**
 * 화면의 시각이 **어느 시간대 기준인지** 한 번만 밝힌다 (POL-0006). 줄마다 약칭을 달면 같은 말이 스무 번 반복된다 —
 * 기준은 위에서 한 번 말하고 각 줄에는 시각만 적는다.
 */
export function TimezoneNote({ subject = '표의 시각은' }: { subject?: string }) {
  const zone = useDisplayTimeZone();
  const label = STUDY_TZS.find((z) => z.key === zone)?.label ?? zone;
  return (
    <p className='mb-2 min-h-5 type-label-sm text-fg-muted' data-testid='timezone-note'>
      {`${subject} 내 프로필 시간대 기준입니다 (${label} · ${tzAbbr(zone)})`}
    </p>
  );
}
