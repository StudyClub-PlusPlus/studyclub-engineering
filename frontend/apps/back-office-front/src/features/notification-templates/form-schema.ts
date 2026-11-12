import { z } from 'zod';

import { BODY_MAX_BYTES, SUBJECT_MAX_LENGTH, utf8Bytes } from '@/features/notification-templates/types';

export const templateSchema = z.object({
  eventType: z.string().min(1),
  subject: z
    .string()
    .max(SUBJECT_MAX_LENGTH)
    .refine((value) => Boolean(value.trim()), '제목을 입력하세요.'),
  body: z
    .string()
    .refine((value) => utf8Bytes(value) <= BODY_MAX_BYTES, '본문 크기 한도를 초과했습니다.')
    .refine((value) => Boolean(value.trim()), '본문을 입력하세요.'),
});
export type TemplateValues = z.infer<typeof templateSchema>;
