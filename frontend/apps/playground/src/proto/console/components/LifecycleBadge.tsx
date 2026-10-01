'use client';

import { useRef, useState } from 'react';

import { LIFECYCLE_HINT, LIFECYCLE_LABEL, LIFECYCLE_TONE } from '@console/components/lifecycle';
import type { LifecycleState } from '@studyclub/mock';
import { Badge } from '@studyclub/ui';

/**
 * 스터디 상태 칩 — 올리면(마우스·키보드 포커스) 그 상태의 뜻과 다음 단계로 넘기는 주체를 보인다.
 *
 * 브라우저 기본 `title` 툴팁은 뜨기까지 오래 걸리고 두 줄을 쓰지 못한다. 목록 표가 가로 스크롤 영역 안이라
 * `absolute` 로 띄우면 잘리므로, 칩 위치를 재서 `fixed` 로 띄운다.
 */
const WIDTH = 256;

export function LifecycleBadge({ state }: { state: LifecycleState }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const hint = LIFECYCLE_HINT[state];

  function show() {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    // 화면 밖으로 나가지 않게 가운데 기준 좌표를 눌러 준다
    const x = Math.min(Math.max(r.left + r.width / 2, WIDTH / 2 + 8), window.innerWidth - WIDTH / 2 - 8);
    setPos({ x, y: r.bottom + 6 });
  }

  return (
    <span
      ref={ref}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
      onFocus={show}
      onBlur={() => setPos(null)}
      className='inline-flex rounded-pill outline-none focus-visible:shadow-[var(--ring)]'
    >
      <Badge tone={LIFECYCLE_TONE[state]} dot className='px-2.5 py-1 font-semibold'>
        {LIFECYCLE_LABEL[state]}
      </Badge>
      {pos && (
        <span
          role='tooltip'
          style={{ position: 'fixed', left: pos.x, top: pos.y, width: WIDTH, transform: 'translateX(-50%)' }}
          className='pointer-events-none z-50 whitespace-normal rounded-control bg-neutral-900 px-3 py-2 text-left text-xs font-normal leading-relaxed text-white shadow-lg'
        >
          <span className='block font-semibold'>{LIFECYCLE_LABEL[state]}</span>
          <span className='block'>{hint.meaning}</span>
          {hint.next && <span className='mt-1 block text-neutral-300'>{hint.next}</span>}
          {hint.clubNote && <span className='mt-1 block border-t border-white/15 pt-1 text-amber-300'>{hint.clubNote}</span>}
        </span>
      )}
    </span>
  );
}
