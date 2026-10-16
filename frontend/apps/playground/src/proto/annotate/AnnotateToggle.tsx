'use client';

import { useAnnotate } from './AnnotateProvider';

/**
 * 화면 위에 떠 있는 토글. 설명이 없는 화면에서는 그렇게 보인다 — 빈칸이 보여야 채운다.
 * 화면 아래 가운데. 이 자리(`--proto-dock`)는 proto.css 가 비워 둔다 — 본문 맨 아래와
 * 표 하단 작업 바(TableActionBar)가 그만큼 위에 앉아 토글과 겹치지 않는다.
 */
export function AnnotateToggle() {
  const { spec, on, toggle } = useAnnotate();
  const has = Boolean(spec?.entries.length);

  return (
    <button
      type='button'
      onClick={toggle}
      disabled={!has}
      title={has ? '설명 켜기/끄기 (A)' : '이 화면은 아직 설명이 없습니다'}
      className='fixed bottom-3 left-1/2 z-[80] -translate-x-1/2 rounded-full px-4 py-2.5 text-[13px] font-bold shadow-lg transition-colors disabled:cursor-not-allowed'
      style={{
        background: !has ? 'var(--color-surface-2)' : on ? 'var(--color-fg)' : 'var(--color-brand)',
        color: !has ? 'var(--color-fg-muted)' : '#fff',
      }}
    >
      {!has ? '설명 없음' : on ? '설명 끄기 · A' : '설명 보기 · A'}
    </button>
  );
}
