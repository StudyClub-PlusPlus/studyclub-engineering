// 마이페이지 내 정보 — 프로필 저장과 마케팅 수신 동의. 키·fetcher·훅을 한곳에. 브라우저가 백엔드를 직접 부른다.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { OnboardingAccount } from '@/lib/api/onboarding';
import { http } from '@/lib/http';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const profileKeys = {
  all: ['profile'] as const,
  // 계정을 키에 넣는다 — 같은 브라우저에서 다른 계정으로 다시 로그인해도 앞 사람의 값이 보이지 않는다
  marketingConsent: (accountId: number) => [...profileKeys.all, 'marketing-consent', accountId] as const,
  account: (accountId: number) => [...profileKeys.all, 'account', accountId] as const,
};

/** PATCH /api/me 요청 바디. 닉네임·시간대 둘 다 필수 — 부분 갱신이 없다. */
export type ProfilePayload = { nickname: string; timeZone: string };

/** 마케팅 수신 동의 현재 값. 동의 기록이 없으면 `agreedAt` 은 null 이다. */
export type MarketingConsent = { agreed: boolean; agreedAt: string | null };

/**
 * GET /auth/me — 편집에 들어갈 때 최신 값을 받는다. 다른 기기에서 먼저 바꿨으면 이 브라우저 세션에는 이전 값이 남아 있다.
 *
 * 화면이 구독하는 값이 아니라 누를 때마다 새로 받아야 해서 `useQuery` 대신 부르는 함수를 돌려준다.
 */
export function useFetchLatestAccount(accountId: number) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.fetchQuery({
      queryKey: profileKeys.account(accountId),
      queryFn: () => http<OnboardingAccount>('/auth/me'),
      // 기본 캐시 시간(1분)을 따르면 방금 받은 값을 다시 돌려준다 — 열 때마다 서버에 묻는다
      staleTime: 0,
    });
}

/** PATCH /api/me — 응답은 `GET /auth/me` 와 같은 모양이라 세션 user 를 이걸로 갱신한다. */
export function useUpdateProfile() {
  return useMutation({
    mutationFn: (payload: ProfilePayload) =>
      http<OnboardingAccount>('/api/me', {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
      }),
  });
}

/** GET /api/me/marketing-consent */
export function useMarketingConsent(accountId: number, enabled: boolean) {
  return useQuery({
    queryKey: profileKeys.marketingConsent(accountId),
    queryFn: () => http<MarketingConsent>('/api/me/marketing-consent'),
    enabled,
  });
}

/**
 * PUT /api/me/marketing-consent
 *
 * 켜고 끄는 토글이라 누른 즉시 화면에 반영하고, 실패하면 이전 값으로 되돌린다.
 */
export function useChangeMarketingConsent(accountId: number) {
  const queryClient = useQueryClient();
  const queryKey = profileKeys.marketingConsent(accountId);
  return useMutation({
    mutationFn: (agreed: boolean) =>
      http<MarketingConsent>('/api/me/marketing-consent', {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify({ agreed }),
      }),
    onMutate: async (agreed) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<MarketingConsent>(queryKey);
      if (previous) queryClient.setQueryData<MarketingConsent>(queryKey, { ...previous, agreed });
      return { previous };
    },
    onError: (_error, _agreed, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSuccess: (saved) => queryClient.setQueryData(queryKey, saved),
  });
}
