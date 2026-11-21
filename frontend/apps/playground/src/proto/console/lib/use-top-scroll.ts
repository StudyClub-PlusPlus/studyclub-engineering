'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 넓은 표의 가로 스크롤바를 표 위에도 하나 더 둔다 — 행이 많으면 아래로 내려가야 스크롤바가 보인다.
 *
 *   const s = useTopScroll();
 *   <div ref={s.topRef} onScroll={s.onTopScroll} aria-hidden='true' className='overflow-x-auto overflow-y-hidden'>
 *     <div style={{ width: s.width, height: 1 }} />
 *   </div>
 *   <div ref={s.bodyRef} onScroll={s.onBodyScroll} className='overflow-x-auto'><table … /></div>
 */
export function useTopScroll() {
  const topRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const update = () => setWidth(el.scrollWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);

  /** 한쪽이 움직이면 다른 쪽을 옮기되, 그 때문에 되돌아오는 이벤트는 무시한다. */
  function sync(from: 'top' | 'body') {
    if (syncing.current) {
      syncing.current = false;
      return;
    }
    const src = from === 'top' ? topRef.current : bodyRef.current;
    const dst = from === 'top' ? bodyRef.current : topRef.current;
    if (!src || !dst || dst.scrollLeft === src.scrollLeft) return;
    syncing.current = true;
    dst.scrollLeft = src.scrollLeft;
  }

  return {
    topRef,
    bodyRef,
    width,
    onTopScroll: () => sync('top'),
    onBodyScroll: () => sync('body'),
  };
}
