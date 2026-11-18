'use client';

import { Select, toast } from '@studyclub/ui';
import { Loader2 } from 'lucide-react';

import { useChangeOwnerCaptain } from '@/features/participants/queries';
import type { OwnerCaptain } from '@/features/participants/types';
import { displayName } from '@/features/users/labels';
import { useUsers } from '@/features/users/queries';
import { ApiError } from '@/lib/http';

/** 후보는 캡틴 계정 전체 — 한 번에 받는다 (스펙: `GET /api/admin/users?role=CAPTAIN&limit=100`). */
const CAPTAIN_FILTER = { role: 'CAPTAIN', offset: 0, limit: 100 } as const;

/**
 * 담당 캡틴 — 스터디당 한 명, 캡틴 계정 중에서 고른다. 명부(참여 크루)와 상관없다 (POL-0001).
 *
 * 명단의 반 · 역할처럼 모았다가 「저장」하지 않고 **고르는 즉시 저장**한다. 저장되기 전에는 지금 값 그대로 두고 옆에서
 * 하나가 돈다 — 실패해도 바뀐 것처럼 남지 않게.
 */
export function OwnerCaptainSection({ studyId, owner }: { studyId: number; owner: OwnerCaptain | null }) {
  const captains = useUsers(CAPTAIN_FILTER);
  const mutation = useChangeOwnerCaptain(studyId);
  const options = captains.data?.items ?? [];
  // 지금 담당 캡틴이 후보 목록에 없을 수 있다(목록을 못 받음 등) — 그래도 지금 값은 보인다
  const showOwnerOption = owner && !options.some((c) => c.id === owner.accountId);

  function pick(value: string) {
    const accountId = Number(value);
    if (!accountId || accountId === owner?.accountId) return;
    mutation.mutate(accountId, {
      onSuccess: () => toast.success('담당 캡틴을 바꿨습니다.'),
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : '담당 캡틴을 바꾸지 못했습니다. 다시 시도해 주세요.'),
    });
  }

  return (
    <section aria-label='담당 캡틴' className='card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3'>
      <h2 className='font-semibold'>담당 캡틴</h2>
      <div className='flex items-center gap-2'>
        <Select
          size='sm'
          aria-label='담당 캡틴'
          value={owner ? String(owner.accountId) : ''}
          disabled={mutation.isPending || captains.isPending}
          onChange={(ev) => pick(ev.target.value)}
          className='w-auto'
        >
          {!owner && <option value=''>없음 · 캡틴 누구나</option>}
          {showOwnerOption && <option value={owner.accountId}>{owner.nickname}</option>}
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {displayName(c)}
            </option>
          ))}
        </Select>
        {mutation.isPending && (
          <span role='status' className='inline-flex'>
            <Loader2 size={16} className='animate-spin text-fg-muted' aria-hidden />
            <span className='sr-only'>저장 중</span>
          </span>
        )}
      </div>
      <p className='type-body-sm text-fg-muted'>신청 폼 수정 · 참여 중단 · 사이트 일정 관리를 맡습니다. 참여하지 않아도 됩니다.</p>
    </section>
  );
}
