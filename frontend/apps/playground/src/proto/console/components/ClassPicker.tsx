'use client';

import { classLabel, type StudyClass } from '@console/lib/classes';

/**
 * 반 고르기 — 일정 탭과 출석 탭이 같은 줄을 쓴다. 회차·출석부는 반마다 하나다.
 *
 * 반이 하나면 그리지 않는다. 탭줄을 늘 띄우면 없는 선택을 있는 것처럼 보이게 한다.
 */
export function ClassPicker({
  classes,
  classId,
  onClass,
  anno,
}: {
  classes: StudyClass[];
  classId: string;
  onClass: (id: string) => void;
  /** 주석 번호 — 화면마다 Story 가 다르다. */
  anno: string;
}) {
  if (classes.length < 2) return null;
  return (
    <nav data-anno={anno} aria-label='반' className='mb-4 flex flex-wrap gap-1.5'>
      {classes.map((c) => (
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
          {classLabel(c)}
        </button>
      ))}
    </nav>
  );
}
