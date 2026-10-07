'use client';

import { useEffect, useRef, useState } from 'react';

import { Badge } from '@studyclub/ui';
import { ChevronDown } from 'lucide-react';

import { ACCOUNT_ROLES, BLOCKED_REASON_MESSAGE, ROLE_TONE, roleLabel } from '@/features/users/labels';
import type { RoleChangeBlockedReason, SystemRole } from '@/features/users/types';

/**
 * 계정 권한 배지 — 누르면 그 자리에서 캡틴·크루를 고른다.
 *
 * 배지가 곧 버튼이다. 배지(현재 상태)와 셀렉트(바꾸는 자리)를 따로 두면 같은 것을 두 번 그리게
 * 된다. 메뉴는 `position: fixed` 로 띄운다 — 표가 가로 스크롤을 가지고 있어 안에 그리면 잘린다.
 *
 * **고를 수 있는 것은 둘뿐이다.** 네비게이터는 계정 권한이 아니라 스터디마다 서는 역할이라
 * 그 스터디의 크루 명단에서 정한다.
 *
 * - `blockedReason` 이 있으면 잠그고 사유를 툴팁으로 보인다 (판정은 서버가 한다).
 * - `pending` 이면 **배지는 그대로 두고** 「변경 중」만 붙인다 — 응답 전에 새 값을 보여주지 않는다.
 */
export function RoleBadgeSelect({
  role,
  blockedReason,
  pending = false,
  onChange,
}: {
  role: SystemRole;
  blockedReason: RoleChangeBlockedReason | null;
  pending?: boolean;
  onChange: (next: SystemRole) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function close() {
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    // 스크롤하면 메뉴만 제자리에 남아 엉뚱한 줄 위에 뜬다. 그냥 닫는다.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const badge = (
    <Badge tone={ROLE_TONE[role]} dot className='whitespace-nowrap px-2.5 py-1 font-semibold'>
      {roleLabel(role)}
    </Badge>
  );

  if (pending) {
    return (
      <span aria-busy='true' className='inline-flex items-center gap-2 opacity-70'>
        {badge}
        <span className='text-xs text-fg-muted'>변경 중</span>
      </span>
    );
  }

  if (blockedReason) {
    return (
      <span
        title={BLOCKED_REASON_MESSAGE[blockedReason]}
        data-blocked={blockedReason}
        className='inline-flex cursor-not-allowed opacity-70'
      >
        {badge}
      </span>
    );
  }

  return (
    <>
      <button
        ref={buttonRef}
        type='button'
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => {
          const r = buttonRef.current?.getBoundingClientRect();
          if (r) setPos({ top: r.bottom + 6, left: r.left });
          setOpen((v) => !v);
        }}
        aria-haspopup='listbox'
        aria-expanded={open}
        className='inline-flex items-center gap-1 rounded-pill transition-opacity hover:opacity-80'
      >
        {badge}
        <ChevronDown size={13} className='text-fg-muted' />
      </button>

      {open && pos && (
        <div
          role='listbox'
          onMouseDown={(e) => e.stopPropagation()}
          style={{ top: pos.top, left: pos.left }}
          className='fixed z-50 rounded-card border border-border bg-surface p-1 shadow-lg'
        >
          {ACCOUNT_ROLES.map((r) => (
            <button
              key={r}
              type='button'
              role='option'
              aria-selected={r === role}
              // mousedown 으로 처리한다. 바깥 클릭 감지가 mousedown 에서 메뉴를 닫아 버리면
              // 버튼이 사라져 click 이 영영 오지 않는다.
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen(false);
                // 현재 값을 다시 고르면 바뀌는 것이 없다 — 요청도 안내도 없다
                if (r !== role) onChange(r);
              }}
              className='flex w-full rounded-control p-1 hover:bg-surface-2'
            >
              <Badge tone={ROLE_TONE[r]} dot className='whitespace-nowrap px-2.5 py-1 font-semibold'>
                {roleLabel(r)}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
