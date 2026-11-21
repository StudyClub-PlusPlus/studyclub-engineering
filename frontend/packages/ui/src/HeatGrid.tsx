'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { cx } from './cx';

export type HeatGridCell = { row: number; col: number };

export interface HeatGridProps {
  /** 격자의 이름 — 스크린리더가 읽는다 (예: 「참여 가능 인원 · 요일 × 시각」). */
  'aria-label': string;
  rows: { key: string; label: ReactNode }[];
  /** `label` 이 있는 열만 머리에 글자를 적는다 — 24칸에 모두 적으면 겹친다. */
  columns: { key: string; label?: ReactNode }[];
  value: (row: number, col: number) => number;
  /** 칸의 설명 — 단추 이름이자 격자 아래 한 줄. 숫자를 반드시 담는다. */
  describe: (row: number, col: number) => string;
  /** 진하기의 기준. 0 이면 모든 칸이 빈 칸 색이다. */
  max: number;
  selected?: HeatGridCell | null;
  /** 칸을 누르면 그 칸, 고른 칸을 다시 누르면 null. 없으면 칸은 보기만 한다. */
  onSelect?: (cell: HeatGridCell | null) => void;
  /** 범례 끝 「최대 n{unit}」 */
  unit?: string;
  /** 아무 칸에도 올라가 있지 않을 때 격자 아래 한 줄 */
  hint?: ReactNode;
  className?: string;
}

const LEVEL = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'] as const;

/** 0 은 빈 칸, 나머지는 최대값의 1/4 마다 한 단계 (design-system.md §2-7). */
export function heatLevel(v: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (v <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((v / max) * 4))) as 1 | 2 | 3 | 4;
}

/**
 * design-system.md §9-8 Heat Grid — 행 × 열 칸의 많고 적음을 §2-7 히트 단계로 칠한다.
 */
export function HeatGrid({
  'aria-label': ariaLabel,
  rows,
  columns,
  value,
  describe,
  max,
  selected,
  onSelect,
  unit = '',
  hint,
  className,
}: HeatGridProps) {
  const [active, setActive] = useState<HeatGridCell | null>(null);
  const [focus, setFocus] = useState<HeatGridCell>(selected ?? { row: 0, col: 0 });
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const cols = columns.length;
  const shown = active ?? selected ?? null;

  function move(ev: KeyboardEvent, row: number, col: number) {
    const delta: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    let next: HeatGridCell | null = null;
    if (delta[ev.key]) {
      const [dr, dc] = delta[ev.key]!;
      next = {
        row: Math.min(rows.length - 1, Math.max(0, row + dr)),
        col: Math.min(cols - 1, Math.max(0, col + dc)),
      };
    } else if (ev.key === 'Home') next = { row, col: 0 };
    else if (ev.key === 'End') next = { row, col: cols - 1 };
    if (!next) return;
    ev.preventDefault();
    setFocus(next);
    setActive(next);
    refs.current[next.row * cols + next.col]?.focus();
  }

  return (
    <div className={cx('min-w-0', className)}>
      <div className='overflow-x-auto pb-1'>
        <div
          role='grid'
          aria-label={ariaLabel}
          className='grid min-w-[36rem] gap-0.5'
          style={{ gridTemplateColumns: `2rem repeat(${cols}, minmax(0, 1fr))` }}
          onMouseLeave={() => setActive(null)}
        >
          <div role='row' className='contents'>
            <span role='columnheader' aria-hidden className='h-5' />
            {columns.map((c) => (
              <span
                key={c.key}
                role='columnheader'
                className='tnum h-5 overflow-visible whitespace-nowrap type-label-sm text-fg-muted'
              >
                {c.label}
              </span>
            ))}
          </div>
          {rows.map((r, ri) => (
            <div key={r.key} role='row' className='contents'>
              <span role='rowheader' className='flex items-center type-label-sm text-fg-secondary'>
                {r.label}
              </span>
              {columns.map((c, ci) => {
                const v = value(ri, ci);
                const level = heatLevel(v, max);
                const isSelected = selected?.row === ri && selected?.col === ci;
                const isFocus = focus.row === ri && focus.col === ci;
                return (
                  <span key={c.key} role='gridcell' className='flex'>
                    <button // ui-native: 격자 칸 전체가 누르는 곳
                      ref={(el) => {
                        refs.current[ri * cols + ci] = el;
                      }}
                      type='button'
                      tabIndex={isFocus ? 0 : -1}
                      aria-label={describe(ri, ci)}
                      aria-pressed={onSelect ? isSelected : undefined}
                      className={cx(
                        'h-6 w-full rounded-xs transition-shadow duration-fast focus-visible:outline-none focus-visible:shadow-(--ring)',
                        LEVEL[level],
                        isSelected && 'outline-2 outline-offset-1 outline-fg',
                        onSelect ? 'cursor-pointer' : 'cursor-default',
                      )}
                      onMouseEnter={() => setActive({ row: ri, col: ci })}
                      onFocus={() => {
                        setFocus({ row: ri, col: ci });
                        setActive({ row: ri, col: ci });
                      }}
                      onBlur={() => setActive(null)}
                      onKeyDown={(ev) => move(ev, ri, ci)}
                      onClick={() => onSelect?.(isSelected ? null : { row: ri, col: ci })}
                    />
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className='mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1'>
        <p aria-live='polite' className='min-h-5 type-body-sm text-fg'>
          {shown ? describe(shown.row, shown.col) : <span className='text-fg-muted'>{hint}</span>}
        </p>
        <div className='flex items-center gap-1.5 type-label-sm text-fg-muted' aria-hidden>
          적음
          {LEVEL.map((cls) => (
            <span key={cls} className={cx('h-3 w-4 rounded-xs', cls)} />
          ))}
          많음
          <span className='tnum ml-1'>
            · 최대 {max}
            {unit}
          </span>
        </div>
      </div>
    </div>
  );
}
