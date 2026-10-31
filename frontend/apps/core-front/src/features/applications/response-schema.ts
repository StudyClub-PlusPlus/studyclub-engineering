import { z } from 'zod';

/** null · 없음을 모두 받아 없음(undefined)으로 맞춘다. */
function optionalFromNull<T extends z.ZodType>(schema: T) {
  return schema.nullish().transform((value) => value ?? undefined);
}

export const apiMyApplicationSchema = z.object({
  applied: z.boolean(),
  applicationId: z.union([z.number(), z.null()]),
  submittedAt: z.union([z.string(), z.null()]),
});

export const apiStudyApplicationFormSchema = z.object({
  studyId: z.number(),
  title: z.string(),
  description: z.union([z.string(), z.null()]),
  schedule: z.union([z.string(), z.null()]),
  recruitDeadline: z.union([z.string(), z.null()]),
  category: z.string(),
  summary: z.string(),
  detail: z.union([z.string(), z.null()]),
  questions: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      type: z.union([
        z.literal('TEXT'),
        z.literal('TEXTAREA'),
        z.literal('RADIO'),
        z.literal('CHECKBOX'),
        z.literal('SELECT'),
      ]),
      required: z.boolean(),
      // 서버는 해당 없는 칸을 null 로 보낸다(텍스트형 질문의 options · allowOther 등) — 화면은 「없음」(undefined)으로 다룬다
      placeholder: optionalFromNull(z.string()),
      description: optionalFromNull(z.string()),
      options: optionalFromNull(z.array(z.string())),
      allowOther: optionalFromNull(z.boolean()),
    }),
  ),
});
