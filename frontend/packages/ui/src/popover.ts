'use client';

import { useEffect, useLayoutEffect } from 'react';
import type { RefObject } from 'react';

const GAP = 6;
const EDGE = 16;

/**
 * 칸이나 칸 끝 단추 아래에 뜨는 고르기 창(DatePicker · TimePicker · TimeZonePicker)의 공통 동작.
 * 표의 가로 스크롤 상자 · 모달 본문처럼 넘침을 자르는 부모 안에서도 잘리지 않도록 화면 기준(fixed)으로 놓는다.
 * 포털로 빼지 않는다 — 모달의 포커스 가두기가 패널 밖 요소를 건너뛴다.
 * 아래 자리가 모자라면 위로 열고, 화면 양쪽에 16px 를 남긴다. 바깥을 누르거나 포커스가 빠지면 닫는다.
 */
export function useAnchoredPopover({
  open,
  onClose,
  rootRef,
  anchorRef,
  panelRef,
  matchWidth = false,
  align = 'start',
}: {
  open: boolean;
  onClose: () => void;
  rootRef: RefObject<HTMLElement | null>;
  anchorRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  /** 창 폭을 칸 폭에 맞춘다(목록형). 달력처럼 폭이 정해진 창은 끈다. */
  matchWidth?: boolean;
  /** 창을 기준 요소의 왼쪽(start) 또는 오른쪽(end)에 맞춘다. 칸 끝 단추에 붙는 창은 end. */
  align?: 'start' | 'end';
}) {
  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      if (matchWidth) panel.style.width = `${anchor.width}px`;
      const { width, height } = panel.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight;
      const below = anchor.bottom + GAP;
      const above = anchor.top - GAP - height;
      const top = below + height > viewportHeight - EDGE && above >= EDGE ? above : below;
      const preferred = align === 'end' ? anchor.right - width : anchor.left;
      const left = Math.max(EDGE, Math.min(preferred, viewportWidth - width - EDGE));
      panel.style.top = `${top}px`;
      panel.style.left = `${left}px`;
      // 부모에 transform · backdrop-filter 가 있으면 fixed 의 기준이 화면이 아니라 그 부모가 된다. 실제로 놓인 자리와의 차이만큼 되민다.
      const placed = panel.getBoundingClientRect();
      if (placed.top !== top || placed.left !== left) {
        panel.style.top = `${2 * top - placed.top}px`;
        panel.style.left = `${2 * left - placed.left}px`;
      }
    };
    reposition();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(reposition);
    if (panelRef.current) observer?.observe(panelRef.current);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, anchorRef, panelRef, matchWidth, align]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: Event) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('focusin', onOutside);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('focusin', onOutside);
    };
  }, [open, onClose, rootRef]);
}

/** 고르기 창 상자 — 화면 기준으로 놓이고 위치는 useAnchoredPopover 가 채운다. */
export const POPOVER_PANEL =
  'fixed z-50 rounded-card border border-border bg-surface-raised p-2 shadow-lg animate-[fadeIn_var(--duration-fast)_var(--ease-out)]';
