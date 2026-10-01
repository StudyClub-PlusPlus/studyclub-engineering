import { useQuery } from '@tanstack/react-query';

import type { ApiUser } from '@/features/users/types';
import { http } from '@/lib/http';

export const userKeys = {
  all: ['users'] as const,
  list: () => [...userKeys.all, 'list'] as const,
};

// TODO(api): GET /accounts 또는 GET /api/users — 유저 목록 조회
export function useUsers() {
  return useQuery({
    queryKey: userKeys.list(),
    queryFn: () => http<ApiUser[]>('/accounts'),
  });
}
