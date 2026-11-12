import { z } from 'zod';

export const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '반 제목을 입력해 주세요.')
    .refine((name) => [...name].length <= 20, '반 제목은 20자까지 입력할 수 있습니다.'),
});
