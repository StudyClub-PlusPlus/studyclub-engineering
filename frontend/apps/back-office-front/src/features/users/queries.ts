// 백오피스 회원 — 목록·이메일 보기·권한 변경·권한표. 키·fetcher·훅을 한 파일에 둔다.
import { toast } from '@studyclub/ui';
import { keepPreviousData, useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DISCORD_NOTICE } from '@/features/users/labels';
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
  /**
   * 줄(계정)마다 mutation 키가 따로다 — 줄이 다시 그려져(페이지를 넘겼다 돌아오는 등) 컴포넌트가 새로 생겨도
   * 진행 중인 요청을 `useIsMutating` 으로 찾아 「처리 중」을 이어 보인다. 중복 제출을 막는 근거다.
   */
  roleChange: (accountId: number) => [...userKeys.all, 'role-change', accountId] as const,
  emailReveal: (accountId: number) => [...userKeys.all, 'email-reveal', accountId] as const,
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
 * ⚠️ 원본을 **쿼리 캐시(MutationCache)에 남기지 않는다.** mutation 의 결과(`state.data`)는 기본적으로
 * 관찰자가 붙어 있는 동안, 그리고 `gcTime`(기본 5분) 동안 캐시에 남는다. 그래서
 * - `gcTime: 0` — 관찰자가 떨어지면 곧바로 캐시에서 지운다.
 * - 호출한 쪽이 결과를 받자마자 `reset()` 으로 관찰자를 뗀다 (EmailCell).
 * 받은 원본은 호출한 화면이 자기 state 에만 둔다. URL·localStorage 에도 넣지 않는다.
 *
 * 줄마다 키가 달라 `isPending` 은 **그 계정의 요청이 진행 중인가**로 센다(`useIsMutating`) — 컴포넌트가
 * 새로 생겨도 이어진다. `isBusy()` 는 같은 판정을 동기로 한다(같은 틱 중복 클릭 방지).
 */
export function useRevealEmail(accountId: number) {
  const queryClient = useQueryClient();
  const mutationKey = userKeys.emailReveal(accountId);
  const mutation = useMutation({
    mutationKey,
    gcTime: 0,
    mutationFn: () => http<ApiEmailReveal>(`/api/admin/users/${accountId}/email-reveals`, { method: 'POST' }),
    // 실패 안내는 훅에서 — 줄이 사라져(목록 갱신) 컴포넌트가 없어져도 안내는 뜬다. 가린 값은 그대로 둔다
    onError: (err) => toast.error(err.message || '이메일을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'),
  });
  const isPending = useIsMutating({ mutationKey }) > 0;
  return {
    mutate: mutation.mutate,
    reset: mutation.reset,
    isPending,
    isBusy: () => queryClient.isMutating({ mutationKey }) > 0,
  };
}

/**
 * 계정 권한 변경. **낙관적 갱신을 하지 않는다** — 응답을 받은 뒤에 바꾼다(캡틴 권한은 백오피스 접근과 이어져
 * 잠깐이라도 잘못 보이면 오해를 부른다). 성공하면 목록을 다시 받는다 — 캡틴 수가 바뀌면 다른 줄의
 * 잠금 사유·정렬·탭 결과도 바뀐다.
 *
 * `onSuccess` 가 무효화 Promise 를 돌려주므로 목록이 새로 올 때까지 mutation 이 진행 중으로 남는다 —
 * 그 줄이 「변경 중」에서 곧바로 새 값으로 넘어간다. 줄마다 키가 달라(`userKeys.roleChange`) 줄이 다시
 * 그려져도 「변경 중」이 이어지고 중복 제출이 막힌다.
 */
export function useChangeAccountRole(accountId: number) {
  const queryClient = useQueryClient();
  const mutationKey = userKeys.roleChange(accountId);
  const mutation = useMutation({
    mutationKey,
    mutationFn: (systemRole: SystemRole) =>
      http<ApiRoleChange>(`/api/admin/users/${accountId}/system-role`, {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify({ systemRole }),
      }),
    // 안내는 훅 단계 콜백에서 띄운다. `mutate(…, { onSuccess })` 처럼 호출 단계에 두면, 성공 뒤 목록이 다시 와서
    // 이 줄이 사라질 때(예: 캡틴 탭에서 내림) 콜백이 불리지 않아 안내가 사라진다. 훅 단계는 언마운트와 상관없이 불린다.
    onSuccess: () => {
      // 디스코드 역할은 자동으로 바뀌지 않는다 — 올림·내림 모두 안내한다
      toast(DISCORD_NOTICE, { duration: 6000 });
      return queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    // 기존 배지는 그대로다(응답 전에 바꾸지 않았다). 사유만 알린다
    onError: (err) => toast.error(err.message || '권한을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.'),
  });
  const isPending = useIsMutating({ mutationKey }) > 0;
  return {
    mutate: mutation.mutate,
    isPending,
    isBusy: () => queryClient.isMutating({ mutationKey }) > 0,
  };
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
