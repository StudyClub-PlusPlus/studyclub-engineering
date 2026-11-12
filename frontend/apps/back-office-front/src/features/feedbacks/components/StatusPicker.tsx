'use client';

import { useEffect, useRef, useState } from 'react';

import { cx } from '@studyclub/ui';
import { Check, ChevronDown, Lock } from 'lucide-react';

import { FeedbackStatusBadge } from '@/features/feedbacks/components/FeedbackBadges';
import {
  STATUS_CLASS,
  STATUS_DISABLED_HINT,
  STATUS_LABEL,
  STATUS_LOCKED_HINT,
  STATUS_OPTIONS,
} from '@/features/feedbacks/labels';
import type { FeedbackStatus } from '@/features/feedbacks/types';

/**
 * 상태 고르기 — **뱃지가 곧 드롭다운이다.** 지금 상태 뱃지를 누르면 같은 모양의 뱃지 셋이 펼쳐진다.
 *
 * 무엇을 고를 수 있는지는 서버가 준 `selectable`(`selectableStatuses`) 그대로다. 회신 유무로 다시 판정하지 않는다.
 * - 목록에 없는 상태는 막고, 이유가 있으면(완료: 「답변을 작성한 후 완료할 수 있어요.」) 그 아래에 적는다
 * - 고를 수 있는 것이 하나도 없으면 드롭다운을 잠근다(회신한 뒤)
 * - `pending` 이면 응답을 기다리는 중이다 — 눌리지 않는다
 */
export function StatusPicker({
  value,
  selectable,
  pending = false,
  onChange,
}: {
  value: FeedbackStatus;
  selectable: readonly FeedbackStatus[];
  pending?: boolean;
  onChange: (next: FeedbackStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const locked = selectable.length === 0;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (locked) {
    // 포커스를 받고(키보드) 이유를 읽어 준다(스크린리더). 마우스는 title 툴팁.
    return (
      <span
        tabIndex={0}
        title={STATUS_LOCKED_HINT}
        aria-label={`상태 ${STATUS_LABEL[value]}. ${STATUS_LOCKED_HINT}`}
        data-testid='status-locked'
        className={cx(
          'inline-flex items-center gap-1 rounded-pill py-1 pl-2.5 pr-2 text-xs font-semibold focus-visible:outline-none focus-visible:shadow-(--ring)',
          STATUS_CLASS[value],
        )}
      >
        {STATUS_LABEL[value]}
        <Lock size={11} aria-hidden='true' />
      </span>
    );
  }

  return (
    <div ref={ref} className='relative'>
      <button
        type='button'
        aria-haspopup='listbox'
        aria-expanded={open}
        aria-busy={pending || undefined}
        aria-label={`상태 ${STATUS_LABEL[value]}, 바꾸기`}
        disabled={pending}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          'inline-flex items-center gap-1 rounded-pill py-1 pl-2.5 pr-1.5 text-xs font-semibold ring-1 ring-transparent transition hover:ring-border-strong disabled:cursor-wait disabled:opacity-70',
          STATUS_CLASS[value],
        )}
      >
        {STATUS_LABEL[value]}
        <ChevronDown size={13} className={cx('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul
          role='listbox'
          aria-label='상태'
          className='absolute right-0 z-20 mt-1.5 flex w-52 flex-col gap-1 rounded-control border border-border bg-surface p-1.5 shadow-lg'
        >
          {STATUS_OPTIONS.map((s) => {
            const enabled = selectable.includes(s.value);
            const hint = enabled ? undefined : STATUS_DISABLED_HINT[s.value];
            return (
              <li key={s.value}>
                <button
                  type='button'
                  role='option'
                  aria-selected={s.value === value}
                  aria-disabled={!enabled || undefined}
                  disabled={!enabled}
                  onClick={() => {
                    setOpen(false);
                    if (s.value !== value) onChange(s.value);
                  }}
                  className='flex w-full flex-col items-start gap-1 rounded-control px-1.5 py-1 text-left hover:bg-surface-2 disabled:cursor-not-allowed disabled:hover:bg-transparent'
                >
                  <span className='flex w-full items-center justify-between'>
                    <FeedbackStatusBadge status={s.value} className={enabled ? undefined : 'opacity-50'} />
                    {s.value === value && <Check size={13} className='text-fg-muted' />}
                  </span>
                  {hint && <span className='text-xs text-fg-muted'>{hint}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
