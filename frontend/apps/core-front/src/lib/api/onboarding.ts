import { apiJson } from './client';

/** POST /accounts/onboarding 요청 바디. age14Confirmed 는 검증만 하고 서버가 저장하지 않는다. */
export type OnboardingPayload = {
  age14Confirmed: boolean;
  termsOfServiceAgreed: boolean;
  privacyPolicyAgreed: boolean;
  marketingAgreed: boolean;
  nickname: string;
  timeZone: string;
};

/** 온보딩 완료 응답 — AccountView. */
export type OnboardingAccount = {
  id: number;
  email: string;
  nickname: string | null;
  picture: string | null;
  role: string;
  createdAt?: string;
  timeZone: string | null;
  onboardingCompletedAt: string | null;
};

export function completeOnboarding(payload: OnboardingPayload): Promise<OnboardingAccount> {
  return apiJson<OnboardingAccount>('/api/accounts/onboarding', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
