'use client';

import { RoleBadgeSelect } from '@/features/users/components/RoleBadgeSelect';
import { useChangeAccountRole } from '@/features/users/queries';
import type { ApiAdminAccount, SystemRole } from '@/features/users/types';

/**
 * 한 줄의 권한 칸. **줄마다 키가 다른 mutation** 이라 처리 중인 줄만 막히고 다른 줄은 계속 바꿀 수 있다.
 * 처리 중 여부는 mutation 캐시에서 읽으므로 줄이 다시 그려져도(페이지를 넘겼다 돌아옴) 「변경 중」이 이어진다.
 * 성공·실패 안내는 훅(`useChangeAccountRole`)이 띄운다 — 성공 뒤 이 줄이 사라져도 안내가 남는다.
 */
export function AccountRoleCell({ account }: { account: ApiAdminAccount }) {
  const change = useChangeAccountRole(account.id);

  function handleChange(systemRole: SystemRole) {
    // 이미 진행 중이면 두 번째 요청을 보내지 않는다 (디스코드 안내·감사 기록이 두 번 쌓인다)
    if (change.isBusy()) return;
    change.mutate(systemRole);
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
