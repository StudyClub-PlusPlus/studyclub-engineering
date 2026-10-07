'use client';

import { toast } from '@studyclub/ui';

import { RoleBadgeSelect } from '@/features/users/components/RoleBadgeSelect';
import { DISCORD_NOTICE } from '@/features/users/labels';
import { useChangeAccountRole } from '@/features/users/queries';
import type { ApiAdminAccount, SystemRole } from '@/features/users/types';

/**
 * 한 줄의 권한 칸. **줄마다 mutation 을 따로 가져서** 처리 중인 줄만 막히고 다른 줄은 계속 바꿀 수 있다.
 *
 * 결과는 `mutateAsync` 로 받는다 — 성공하면 목록이 다시 와서 이 줄이 사라질 수 있는데(예: 캡틴 탭에서
 * 내린 경우) 그러면 `mutate(…, { onSuccess })` 의 콜백은 불리지 않아 안내가 사라진다.
 */
export function AccountRoleCell({ account }: { account: ApiAdminAccount }) {
  const change = useChangeAccountRole();

  async function handleChange(systemRole: SystemRole) {
    try {
      await change.mutateAsync({ accountId: account.id, systemRole });
      // 디스코드 역할은 자동으로 바뀌지 않는다 — 올림·내림 모두 안내한다
      toast(DISCORD_NOTICE, { duration: 6000 });
    } catch (err) {
      // 기존 배지는 그대로다(응답 전에 바꾸지 않았다). 사유만 알린다.
      toast.error(err instanceof Error ? err.message : '권한을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  return (
    <RoleBadgeSelect
      role={account.systemRole}
      blockedReason={account.roleChangeBlockedReason}
      pending={change.isPending}
      onChange={handleChange}
    />
  );
}
