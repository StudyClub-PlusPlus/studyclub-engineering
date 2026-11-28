'use client';

import { useEffect, useState } from 'react';

import { captainOnRoster, setCaptainOnRoster } from '@core/lib/retros';
import { Select } from '@studyclub/ui';

/**
 * 회고 검토 도구 — 담당 캡틴이 반 명부에 있는지 바꿔 본다. 서비스 화면이 아니라 프로토 검토용.
 * 명부에 있으면 캡틴도 참여자처럼 회고를 쓰고, 명부에 없으면 쓰지 않는다.
 */
export function RetroRosterToolbar({ studyId }: { studyId: string }) {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => setOn(captainOnRoster(studyId)), [studyId]);
  if (on === null) return null;

  return (
    <aside aria-label='회고 검토 도구' className='mb-4 rounded-card border border-dashed border-border bg-surface-1 px-4 py-2.5'>
      <label className='flex flex-wrap items-center gap-2 type-label-sm text-fg-muted'>
        <span className='font-semibold'>프로토 가정 · 캡틴의 반 명부</span>
        <Select
          size='sm'
          value={on ? 'in' : 'out'}
          onChange={(event) => {
            setCaptainOnRoster(studyId, event.target.value === 'in');
            // 회고 상태 · 작성 현황을 처음부터 다시 그린다
            window.location.reload();
          }}
        >
          <option value='in'>명부에 있음 — 회고를 쓴다</option>
          <option value='out'>명부에 없음 — 회고를 쓰지 않는다</option>
        </Select>
      </label>
    </aside>
  );
}
