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
  /** 칸에 마우스 · 포커스를 올리면 칸 옆에 띄우는 말풍선 내용 (예: 그 칸에 든 사람 이름). 없으면 띄우지 않는다. */
  tooltip?: (row: number, col: number) => ReactNode;
  /** 칸 안에 값을 숫자로 적는다 (0 은 비운다). 칸이 넓을 때(열 12칸 이하)만 쓴다. */
  showValues?: boolean;
  className?: string;
}

const LEVEL = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'] as const;
// 칸 안 숫자 — heat-0~2 는 fg(대비 5.84 이상), heat-3 · 4 는 fg-on-color(4.89 이상) (design-system.md §2-7)
const VALUE_TEXT = ['text-fg', 'text-fg', 'text-fg', 'text-fg-on-color', 'text-fg-on-color'] as const;

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
  tooltip,
  showValues = false,
  className,
}: HeatGridProps) {
  const [active, setActive] = useState<HeatGridCell | null>(null);
  const [tipAt, setTipAt] = useState<{ top: number; left: number; flip: boolean } | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [focus, setFocus] = useState<HeatGridCell>(selected ?? { row: 0, col: 0 });
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const cols = columns.length;
  const shown = active ?? selected ?? null;

  function enter(cell: HeatGridCell, el: HTMLElement) {
    setActive(cell);
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const r = el.getBoundingClientRect();
    // 칸 오른쪽에 띄우고, 오른쪽 자리가 모자라면 왼쪽에 띄운다
    const flip = r.right + 224 > box.right;
    setTipAt({ top: r.top - box.top + r.height / 2, left: flip ? r.left - box.left : r.right - box.left, flip });
  }

  function leave() {
    setActive(null);
    setTipAt(null);
  }

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
    refs.current[next.row * cols + next.col]?.focus();
  }

  return (
    <div ref={boxRef} className={cx('relative min-w-0', className)}>
      <div className='overflow-x-auto pb-1'>
        <div
          role='grid'
          aria-label={ariaLabel}
          // 열이 많으면(시각 24칸) 좁은 화면에서 가로로 민다. 열이 적으면(요일 7칸) 그대로 줄어든다
          className={cx('grid gap-0.5', cols > 12 ? 'min-w-[36rem]' : 'min-w-[16rem]')}
          style={{ gridTemplateColumns: `2.5rem repeat(${cols}, minmax(0, 1fr))` }}
          onMouseLeave={leave}
        >
          <div role='row' className='contents'>
            <span role='columnheader' aria-hidden className='h-5' />
            {columns.map((c) => (
              <span
                key={c.key}
                role='columnheader'
                className={cx(
                  'tnum h-5 overflow-visible whitespace-nowrap type-label-sm text-fg-muted',
                  cols <= 12 && 'text-center',
                )}
              >
                {c.label}
              </span>
            ))}
          </div>
          {rows.map((r, ri) => (
            <div key={r.key} role='row' className='contents'>
              <span role='rowheader' className='tnum flex items-center type-label-sm text-fg-secondary'>
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
                        showValues && 'tnum type-label-sm font-semibold',
                        showValues && VALUE_TEXT[level],
                        'h-6 w-full rounded-xs transition-shadow duration-fast focus-visible:outline-none focus-visible:shadow-(--ring)',
                        LEVEL[level],
                        isSelected && 'outline-2 outline-offset-1 outline-fg',
                        onSelect ? 'cursor-pointer' : 'cursor-default',
                      )}
                      onMouseEnter={(ev) => enter({ row: ri, col: ci }, ev.currentTarget)}
                      onFocus={(ev) => {
                        setFocus({ row: ri, col: ci });
                        enter({ row: ri, col: ci }, ev.currentTarget);
                      }}
                      onBlur={leave}
                      onKeyDown={(ev) => move(ev, ri, ci)}
                      onClick={() => onSelect?.(isSelected ? null : { row: ri, col: ci })}
                    >
                      {showValues && v > 0 ? <span aria-hidden>{v}</span> : null}
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {tooltip && active && tipAt && (
        <div
          role='tooltip'
          className={cx(
            'pointer-events-none absolute z-30 w-52 max-w-[calc(100vw-2rem)] -translate-y-1/2 rounded-card border border-border bg-surface-raised p-3 shadow-md',
            tipAt.flip ? '-translate-x-full -ml-2' : 'ml-2',
          )}
          style={{ top: tipAt.top, left: tipAt.left }}
        >
          <p className='type-label-sm font-semibold text-fg'>{describe(active.row, active.col)}</p>
          <div className='mt-1 type-label-sm text-fg-secondary'>{tooltip(active.row, active.col)}</div>
        </div>
      )}
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
