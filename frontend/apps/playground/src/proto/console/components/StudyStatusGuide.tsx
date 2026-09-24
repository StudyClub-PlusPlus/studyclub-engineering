import { LIFECYCLE_ORDER } from '@console/components/lifecycle';
import { LifecycleBadge } from '@console/components/LifecycleBadge';
import { ChevronRight } from 'lucide-react';

/**
 * 스터디 상태 안내 — 목록 위 한 줄.
 *
 * 다섯 단계를 순서대로 늘어놓고, 각 칩에 올리면 뜻과 다음 단계로 넘기는 주체가 보인다(`LifecycleBadge`).
 * 모집중/마감은 상태가 아니라 모집 시작일·종료일과 정원으로 계산하는 별도 값이라 끝에 한 줄만 적는다.
 */
export function StudyStatusGuide() {
  return (
    <div data-anno='status:1' className='mb-4 flex flex-wrap items-center gap-x-1 gap-y-2 text-xs text-fg-muted'>
      <span className='mr-1 font-semibold text-fg-secondary'>스터디 상태</span>
      {LIFECYCLE_ORDER.map((state, i) => (
        <span key={state} className='inline-flex items-center gap-1'>
          <LifecycleBadge state={state} />
          {i < LIFECYCLE_ORDER.length - 1 && <ChevronRight size={12} aria-hidden='true' />}
        </span>
      ))}
    </div>
  );
}
