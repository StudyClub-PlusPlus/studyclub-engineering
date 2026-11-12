import type { Locale } from '@studyclub/types';
import { z } from 'zod';

import { nicknameError } from '@/features/onboarding/model';

/** 형식 규칙은 온보딩과 같은 함수 하나를 쓴다 — 두 화면이 같은 닉네임을 두고 다른 말을 하면 안 된다. */
export function profileSchema(locale: Locale) {
  return z.object({
    nickname: z.string().superRefine((value, ctx) => {
      const message = nicknameError(value, locale);
      if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    }),
    timeZone: z.string().min(1, '시간대를 다시 선택해 주세요'),
  });
}

export type ProfileFormValues = z.infer<ReturnType<typeof profileSchema>>;
