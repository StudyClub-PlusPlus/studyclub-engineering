'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { ScreenSpec } from './types';

type Ctx = {
  /** 이 화면에 등록된 Story 스펙들. 등록 순서를 유지한다. */
  specs: ScreenSpec[];
  /** 지금 고른 Story. 등록이 없으면 null. */
  spec: ScreenSpec | null;
  activeIndex: number;
  setActiveIndex: (i: number) => void;
  on: boolean;
  toggle: () => void;
  register: (s: ScreenSpec) => () => void;
};

const AnnotateCtx = createContext<Ctx | null>(null);

export function useAnnotate(): Ctx {
  const v = useContext(AnnotateCtx);
  if (!v) throw new Error('useAnnotate 는 <AnnotateProvider> 안에서만 쓴다.');
  return v;
}

export function AnnotateProvider({ children }: { children: React.ReactNode }) {
  // 한 지면에 Story 가 여럿 산다. 화면 하나 = 스펙 하나로 두면 번호가 한 줄에 뒤섞이고,
  // 어느 번호가 어느 Story 것인지 캡처만 봐서는 알 수 없다.
  const [specs, setSpecs] = useState<ScreenSpec[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [on, setOn] = useState(false);

  const toggle = useCallback(() => setOn((v) => !v), []);

  const register = useCallback((s: ScreenSpec) => {
    setSpecs((list) => (list.includes(s) ? list : [...list, s]));
    return () => setSpecs((list) => list.filter((x) => x !== s));
  }, []);

  // 등록이 바뀌어 고른 칩이 사라지면 첫 칩으로 되돌린다.
  useEffect(() => {
    setActiveIndex((i) => (i < specs.length ? i : 0));
  }, [specs.length]);

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

  const spec = specs[activeIndex] ?? null;
  const value = useMemo(
    () => ({ specs, spec, activeIndex, setActiveIndex, on, toggle, register }),
    [specs, spec, activeIndex, on, toggle, register],
  );
  return <AnnotateCtx.Provider value={value}>{children}</AnnotateCtx.Provider>;
}

/**
 * 화면이 자기 Story 스펙을 등록한다. 화면 컴포넌트 안에 한 줄 놓으면 된다.
 *
 * 한 지면에 Story 가 여럿이면 이 줄을 여러 번 놓는다. 등록된 수만큼 패널 위에 칩이 서고,
 * 고른 Story 의 번호만 화면에 뜬다.
 *
 * 스펙이 없는 화면은 토글 버튼이 비활성으로 보인다 — "아직 안 썼다"가 눈에 보여야 한다.
 */
export function ScreenSpecRegistrar({ spec }: { spec: ScreenSpec }) {
  const { register } = useAnnotate();
  useEffect(() => register(spec), [spec, register]);
  return null;
}
