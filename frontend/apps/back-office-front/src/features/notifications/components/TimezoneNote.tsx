'use client';

import { useEffect, useState } from 'react';

/**
 * 표의 시각이 **어느 시간대 기준인지** 한 번만 밝힌다 (POL-0006). 줄마다 약칭을 달면 같은 말이 스무 번 반복된다 —
 * 기준은 위에서 한 번 말하고 각 줄에는 시각만 적는다.
 *
 * 시간대는 브라우저만 안다. 서버에서 그린 화면과 달라 하이드레이션이 어긋나지 않도록 마운트 뒤에 채우고,
 * 그 전에도 한 줄의 높이는 지켜 표가 아래로 밀리지 않게 한다.
 */
export function TimezoneNote() {
  const [zone, setZone] = useState('');

  useEffect(() => {
    const id = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = new Intl.DateTimeFormat('ko-KR', { timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value;
    setZone(offset ? `${id} · ${offset}` : id);
  }, []);

  return (
    <p className='mb-2 min-h-5 text-xs text-fg-muted' data-testid='timezone-note'>
      {zone && `표의 시각은 내 시간대 기준입니다 (${zone})`}
    </p>
  );
}
