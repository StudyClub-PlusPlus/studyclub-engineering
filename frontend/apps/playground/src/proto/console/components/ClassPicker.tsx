'use client';

import { classLabel, type StudyClass } from '@console/lib/classes';

/**
 * 반 고르기 — 일정 탭과 출석 탭이 같은 줄을 쓴다. 회차·출석부는 반마다 하나다.
 *
 * 반이 하나면 그리지 않는다. 탭줄을 늘 띄우면 없는 선택을 있는 것처럼 보이게 한다.
 *
 * `withAll` 이면 맨 앞에 「전체」 칩을 둔다(값 `ALL_CLASSES`) — 신청자 탭 명단 필터 · 출석 탭 전체 보기.
 */
export const ALL_CLASSES = 'all';

export function ClassPicker({
  classes,
  classId,
  onClass,
  anno,
  withAll = false,
  className = 'mb-4',
}: {
  classes: StudyClass[];
  classId: string;
  onClass: (id: string) => void;
  /** 주석 번호 — 화면마다 Story 가 다르다. */
  anno: string;
  withAll?: boolean;
  className?: string;
}) {
  if (classes.length < 2) return null;
  const chips = withAll
    ? [{ id: ALL_CLASSES, title: '전체' }, ...classes.map((c) => ({ id: c.id, title: classLabel(c) }))]
    : classes.map((c) => ({ id: c.id, title: classLabel(c) }));
  return (
    <nav data-anno={anno} aria-label='반' className={`flex flex-wrap gap-1.5 ${className}`}>
      {chips.map((c) => (
        <button
          key={c.id}
          type='button'
          aria-pressed={c.id === classId}
          onClick={() => onClass(c.id)}
          className={`rounded-pill border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
            c.id === classId
              ? 'border-brand bg-brand text-white'
              : 'border-border-strong bg-bg text-fg-secondary hover:bg-surface-2'
          }`}
        >
          {c.title}
        </button>
      ))}
    </nav>
  );
}
