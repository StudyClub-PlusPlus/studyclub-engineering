import { accountSchema } from '@/features/account/response-schema';
import type { Account } from '@/features/account/types';
import { http } from '@/lib/http';

/** POST /accounts/onboarding 요청 바디. age14Confirmed 는 검증만 하고 서버가 저장하지 않는다. */
export type OnboardingPayload = {
  age14Confirmed: boolean;
  termsOfServiceAgreed: boolean;
  privacyPolicyAgreed: boolean;
  marketingAgreed: boolean;
  nickname: string;
  timeZone: string;
  /** GA4 client_id — 서버 sign_up(Measurement Protocol)의 유입 귀속용. 선택. */
  gaClientId?: string;
};

export function completeOnboarding(payload: OnboardingPayload): Promise<Account> {
  return http('/accounts/onboarding', accountSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, { refreshOnUnauthorized: true });
}
