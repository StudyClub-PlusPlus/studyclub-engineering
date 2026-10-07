// 백오피스 회원 — 목록·이메일 보기·권한 변경·권한표. 키·fetcher·훅을 한 파일에 둔다.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  ApiAdminAccountPage,
  ApiEmailReveal,
  ApiRoleChange,
  ApiRolePermissions,
  SystemRole,
  UserFilter,
} from '@/features/users/types';
import { http, qs } from '@/lib/http';

/**
 * 키는 넓은 것에서 좁은 것으로 쌓는다 — `['users']` 를 무효화하면 목록이 전부 딸려 간다.
 * 권한표는 사람 목록과 무관하게 배포 사이에 바뀌지 않으므로 따로 둔다(무효화에 딸려 가지 않게).
 */
export const userKeys = {
  all: ['users'] as const,
  list: (filter: UserFilter) => [...userKeys.all, 'list', filter] as const,
  rolePermissions: () => ['role-permissions'] as const,
};

/** 목록 요청 경로. 값이 없는 조건은 넣지 않는다. `role=ALL` 은 기본값이라 싣지 않는다. */
export function usersPath(filter: UserFilter): string {
  return `/api/admin/users${qs({
    role: filter.role === 'ALL' ? undefined : filter.role,
    q: filter.q?.trim(),
    offset: filter.offset,
    limit: filter.limit,
  })}`;
}

export function useUsers(filter: UserFilter) {
  return useQuery({
    queryKey: userKeys.list(filter),
    queryFn: () => http<ApiAdminAccountPage>(usersPath(filter)),
    // 탭·검색·페이지를 바꾸는 동안 이전 결과를 지우지 않는다 — 표가 깜빡이면 보던 자리를 잃는다.
    placeholderData: keepPreviousData,
  });
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * 한 명의 이메일 원본 보기. 서버가 볼 때마다 감사 로그를 남긴다.
 *
 * ⚠️ 결과를 **쿼리 캐시에 넣지 않는다**(mutation 결과는 캐시 키가 없다) — 받은 원본은 호출한 화면이 자기
 * state 에만 둔다. URL·localStorage 에도 넣지 않는다.
 */
export function useRevealEmail() {
  return useMutation({
    mutationFn: (accountId: number) =>
      http<ApiEmailReveal>(`/api/admin/users/${accountId}/email-reveals`, { method: 'POST' }),
  });
}

/**
 * 계정 권한 변경. **낙관적 갱신을 하지 않는다** — 응답을 받은 뒤에 바꾼다(캡틴 권한은 백오피스 접근과 이어져
 * 잠깐이라도 잘못 보이면 오해를 부른다). 성공하면 목록을 다시 받는다 — 캡틴 수가 바뀌면 다른 줄의
 * 잠금 사유·정렬·탭 결과도 바뀐다.
 *
 * `onSuccess` 가 무효화 Promise 를 돌려주므로 목록이 새로 올 때까지 mutation 이 진행 중으로 남는다 —
 * 그 줄이 「변경 중」에서 곧바로 새 값으로 넘어간다.
 */
export function useChangeAccountRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, systemRole }: { accountId: number; systemRole: SystemRole }) =>
      http<ApiRoleChange>(`/api/admin/users/${accountId}/system-role`, {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ systemRole }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  });
}

/** 권한표 — 모달을 열 때만 부른다(`enabled`). 배포 사이에 바뀌지 않아 오래 신선하게 둔다. */
export function useRolePermissions(enabled: boolean) {
  return useQuery({
    queryKey: userKeys.rolePermissions(),
    queryFn: () => http<ApiRolePermissions>('/api/admin/role-permissions'),
    enabled,
    staleTime: 60 * 60 * 1000,
  });
}
