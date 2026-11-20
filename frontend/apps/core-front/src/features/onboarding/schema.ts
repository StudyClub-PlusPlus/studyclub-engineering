import type { Locale } from '@studyclub/types';
import { z } from 'zod';

import { isOnboardingTimeZone, nicknameError } from './model';

export function makeOnboardingSchema(locale: Locale) {
  const consentMessage = locale === 'ko' ? '필수 항목을 확인해 주세요.' : 'Confirm the required items to join.';
  return z.object({
    nickname: z.string().superRefine((value, ctx) => {
      const message = nicknameError(value, locale);
      if (message) ctx.addIssue({ code: 'custom', message });
    }),
    timeZone: z
      .string()
      .refine(
        (value) => Boolean(isOnboardingTimeZone(value)),
        locale === 'ko' ? '시간대를 다시 선택해 주세요' : 'Choose a time zone again.',
      ),
    ageConfirmed: z.boolean().refine(Boolean, consentMessage),
    termsOfServiceAgreed: z.boolean().refine(Boolean, consentMessage),
    privacyPolicyAgreed: z.boolean().refine(Boolean, consentMessage),
    marketingAgreed: z.boolean(),
  });
}
export type OnboardingFormValues = z.infer<ReturnType<typeof makeOnboardingSchema>>;
