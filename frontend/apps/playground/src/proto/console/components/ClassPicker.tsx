'use client';

import { classLabel, type StudyClass } from '@console/lib/classes';
import { FilterChip } from '@studyclub/ui';

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
        <FilterChip key={c.id} selected={c.id === classId} selectMode='single' onClick={() => onClass(c.id)}>
          {classLabel(c)}
        </FilterChip>
      ))}
    </nav>
  );
}
