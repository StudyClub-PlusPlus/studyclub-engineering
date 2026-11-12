import { z } from 'zod';

export const rulesSchema = z.object({ rules: z.string().max(500, '규칙은 500자까지 쓸 수 있습니다.') });
export type RulesValues = z.infer<typeof rulesSchema>;
