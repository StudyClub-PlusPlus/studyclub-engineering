'use client';

import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from './cx';

/**
 * 표 하단 작업 바 — design-system.md §9-12 · POL-0008 「표 하단 작업 바」.
 *
 * 고르고 · 고치고 · 저장하는 표 아래에 **한 줄**로 붙는다. 화면 아래에 붙어 따라온다.
 * - `selection`(왼쪽): 고른 것에 하는 일 — `<SelectionCount>` · 일괄 적용 · 삭제 · 선택 해제
 * - `save`(오른쪽): 변경 취소 · 저장
 *
 * 선택 줄과 저장 줄을 따로 쌓지 않는다 — 두 줄이면 어느 버튼이 무엇에 걸리는지 흐려진다.
 * 배경은 페이지와 같은 색 하나뿐이다(스크롤할 때 표가 비치지 않게). 띠 · 테두리 · 그림자를 넣지 않는다.
 * 붙는 높이는 CSS 변수 `--table-action-bar-bottom`(기본 0) — 화면 아래에 다른 고정 요소가 있는 곳(playground 의 「설명 보기」)만 올린다.
 */
export interface TableActionBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** 위치 — 기본 'bottom'(화면 하단 sticky). 'top' 지정 시 테이블 상단에 sticky 고정. */
  position?: 'top' | 'bottom';
  /** 왼쪽 — 고른 것에 하는 일. 고를 수 없는 표면 비운다. */
  selection?: ReactNode;
  /** 오른쪽 — 변경 취소 · 저장. */
  save?: ReactNode;
}

export function TableActionBar({ selection, save, position = 'bottom', className, ...rest }: TableActionBarProps) {
  const isTop = position === 'top';
  return (
    <div
      role='region'
      aria-label='표 작업'
      {...rest}
      className={cx(
        'z-20 flex flex-wrap items-center gap-2 bg-bg py-2',
        isTop ? 'sticky top-[var(--table-action-bar-top,4rem)]' : 'sticky bottom-[var(--table-action-bar-bottom,0px)]',
        className,
      )}
    >
      {selection && <div className='flex flex-wrap items-center gap-2'>{selection}</div>}
      {save && <div className='ml-auto flex items-center gap-2'>{save}</div>}
    </div>
  );
}

export interface SelectionCountProps {
  count: number;
  /** 전체 선택 가능 수 — 「전체 N / M명 선택」으로 표시. */
  total?: number;
  /** 세는 단위 — 사람은 「명」, 회차 · 물건은 「개」. */
  unit?: '명' | '개';
}

/** 「전체 20 · 3명 선택」 — 작업 바 맨 왼쪽. 0 이어도 보인다 — 고를 수 있는 표라는 것을 알린다. */
export function SelectionCount({ total, count, unit = '개' }: SelectionCountProps) {
  return (
    <span aria-live='polite' className={cx('tnum mr-1 text-sm font-semibold', count > 0 ? 'text-fg' : 'text-fg-muted')}>
      {total !== undefined && <span className='font-medium text-fg-muted'>전체 {total} · </span>}
      {count}
      {unit} 선택
    </span>
  );
}
