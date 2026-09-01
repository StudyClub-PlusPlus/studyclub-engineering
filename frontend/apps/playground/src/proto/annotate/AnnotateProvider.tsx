'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { ScreenSpec } from './types';

type Ctx = {
  spec: ScreenSpec | null;
  on: boolean;
  toggle: () => void;
  setSpec: (s: ScreenSpec | null) => void;
};

const AnnotateCtx = createContext<Ctx | null>(null);

export function useAnnotate(): Ctx {
  const v = useContext(AnnotateCtx);
  if (!v) throw new Error('useAnnotate 는 <AnnotateProvider> 안에서만 쓴다.');
  return v;
}

export function AnnotateProvider({ children }: { children: React.ReactNode }) {
  const [spec, setSpec] = useState<ScreenSpec | null>(null);
  const [on, setOn] = useState(false);

  const toggle = useCallback(() => setOn((v) => !v), []);

  // 키보드 A — 마우스를 화면에서 떼지 않고 번호를 껐다 켜며 대조한다.
  // 입력 중에는 무시한다. 안 그러면 검색창에 'a' 를 칠 때마다 오버레이가 깜빡인다.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'a' && e.key !== 'A') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      setOn((v) => !v);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo(() => ({ spec, on, toggle, setSpec }), [spec, on, toggle]);
  return <AnnotateCtx.Provider value={value}>{children}</AnnotateCtx.Provider>;
}

/**
 * 화면이 자기 스펙을 등록한다. 화면 컴포넌트 안에 한 줄 놓으면 된다.
 * 스펙이 없는 화면은 토글 버튼이 비활성으로 보인다 — "아직 안 썼다"가 눈에 보여야 한다.
 */
export function ScreenSpecRegistrar({ spec }: { spec: ScreenSpec }) {
  const { setSpec } = useAnnotate();
  useEffect(() => {
    setSpec(spec);
    return () => setSpec(null);
  }, [spec, setSpec]);
  return null;
}
