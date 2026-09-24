import { useQuery } from '@tanstack/react-query';

import type { ApiUser } from '@/features/users/types';
import { http } from '@/lib/http';

export const userKeys = {
  all: ['users'] as const,
  list: () => [...userKeys.all, 'list'] as const,
};

export function useUsers() {
  return useQuery({
    queryKey: userKeys.list(),
    queryFn: () => http<ApiUser[]>('/api/users'),
  });
}
