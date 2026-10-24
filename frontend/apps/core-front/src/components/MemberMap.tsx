'use client';

import { useEffect, useState } from 'react';

import type { Locale } from '@/lib/content';
import { REGIONS, project, tzLabel } from '@/lib/regions';

/**
 * 크루가 있는 곳 — 점 지도(public/about-art/world-dots.svg, Natural Earth 110m 육지) 위에 지역 핀.
 * 핀 위치는 lib/regions.ts 의 위경도를 SVG 와 같은 투영으로 옮긴다. 시간대 표기는 서머타임 때문에 마운트 뒤에 그린다.
 */
export function MemberMap({ locale }: { locale: Locale }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className='card overflow-hidden p-4 sm:p-6'>
      <div className='relative w-full' style={{ aspectRatio: '360 / 131' }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 정적 SVG, 최적화 대상 아님 */}
        <img src='/about-art/world-dots.svg' alt='' className='absolute inset-0 h-full w-full' />
        {REGIONS.map((r) => {
          const pos = project(r.lat, r.lon);
          return (
            <div key={r.id} className='absolute -translate-x-1/2 -translate-y-1/2' style={pos}>
              <span className='relative flex h-3 w-3'>
                <span className='absolute inline-flex h-full w-full animate-ping rounded-full opacity-60' style={{ background: r.color }} />
                <span className='relative inline-flex h-3 w-3 rounded-full ring-2 ring-white' style={{ background: r.color }} />
              </span>
            </div>
          );
        })}
      </div>
      {/* 핀 이름표는 지도 아래 목록으로 — 미국 세 곳이 가까워 지도 위에 쓰면 겹친다 */}
      <ul className='mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
        {REGIONS.map((r) => {
          const tz = mounted ? tzLabel(r.tz) : null;
          return (
            <li key={r.id} className='flex items-center gap-2.5 text-sm'>
              <span className='h-2.5 w-2.5 shrink-0 rounded-full' style={{ background: r.color }} />
              <span className='font-semibold'>{locale === 'ko' ? r.name.ko : r.name.en}</span>
              <span className='text-(--color-fg-muted)'>{locale === 'ko' ? r.city.ko : r.city.en}</span>
              <span className='ml-auto text-xs font-medium tabular-nums text-(--color-fg-faint)' suppressHydrationWarning>
                {tz ? [tz.abbr, tz.offset].filter(Boolean).join(' · ') : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
