'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { CircleHelp } from 'lucide-react';

import { IconButton } from './Button';
import { cx } from './cx';

/**
 * design-system.md §9-8 Help Popover — 제목 · 값 옆 작은 「?」(또는 ⓘ)를 누르면 그 자리 아래에 짧은 설명이 뜬다.
 * 늘 펼쳐 두는 안내문 대신 궁금한 사람만 연다. 바깥을 누르거나 포커스가 빠지거나 Esc 를 누르면 닫히고, Esc 는 단추로 포커스를 되돌린다.
 * 글줄(<p> · <dd>) 안에도 놓이도록 span 으로만 짠다 — 내용(children)도 span · 글자로 넘긴다.
 */
export interface HelpPopoverProps {
  /** 단추와 말풍선의 이름(스크린리더). 예: 「발표 표시 설명」 */
  label: string;
  children: ReactNode;
  /** 단추 아이콘. 기본은 CircleHelp(?) — 기준 · 출처 안내처럼 「정보」면 Info 를 넘긴다. */
  icon?: ReactNode;
  /** 선호하는 정렬. 화면 밖으로 나가면 양쪽에 16px 여백을 남기도록 보정한다. */
  align?: 'start' | 'end';
  className?: string;
}

export function HelpPopover({ label, children, icon = <CircleHelp />, align = 'start', className }: HelpPopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();

  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      const root = rootRef.current;
      const panel = panelRef.current;
      if (!root || !panel) return;
      const anchor = root.getBoundingClientRect();
      const width = panel.getBoundingClientRect().width;
      const viewportWidth = document.documentElement.clientWidth;
      const preferred = align === 'end' ? anchor.right - width : anchor.left;
      const left = Math.max(16, Math.min(preferred, viewportWidth - width - 16));
      panel.style.left = `${left - anchor.left}px`;
      panel.style.right = 'auto';
    };
    reposition();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(reposition);
    if (rootRef.current) observer?.observe(rootRef.current);
    if (panelRef.current) observer?.observe(panelRef.current);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (event: Event) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('focusin', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('focusin', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={cx('relative inline-flex align-middle', className)}>
      <IconButton
        ref={buttonRef}
        variant='tertiary'
        size='xs'
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        icon={icon}
      />
      {open && (
        <span
          ref={panelRef}
          id={panelId}
          role='dialog'
          aria-label={label}
          className={cx(
            'absolute top-full z-30 mt-1.5 block w-72 max-w-[calc(100vw-2rem)] rounded-card border border-border bg-surface-raised p-3 text-left type-label-sm font-normal text-fg-secondary shadow-md',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {children}
        </span>
      )}
    </span>
  );
}
