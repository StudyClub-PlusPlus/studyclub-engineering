import { z } from 'zod';

export const eventFormSchema = z.object({
  title: z.string().refine((value) => Boolean(value.trim()), '행사명을 입력하세요.'),
  summary: z.string().refine((value) => Boolean(value.trim()), '한 줄 소개를 입력하세요.'),
  type: z.string().min(1, '타입을 선택하세요.'),
  date: z.string().min(1, '날짜를 입력하세요.'),
  location: z.string(),
  link: z.string(),
});

export type EventFormValues = z.infer<typeof eventFormSchema>;
