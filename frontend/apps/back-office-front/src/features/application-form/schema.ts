import type { ApplicationQuestionType } from '@studyclub/mock';
import { z } from 'zod';

import { allowsOther, needsOptions } from './question';
import type { ApiQuestion, ApplicationFormResponse } from './types';

const singleLine = (value: string) => value.replace(/[\r\n\t]/g, ' ').trim();
const shortText = z.string().transform(singleLine).pipe(z.string().max(200, '200자 이내로 입력해 주세요.'));

export const applicationFormSchema = z.object({
  title: shortText,
  description: z.string().max(5000, '5,000자 이내로 입력해 주세요.'),
  questions: z
    .array(
      z
        .object({
          id: z
            .string()
            .min(1)
            .refine((id) => id !== 'discord'),
          label: shortText.pipe(z.string().min(1, '질문 제목을 입력해 주세요.')),
          type: z.enum(['text', 'textarea', 'radio', 'checkbox', 'select']),
          required: z.boolean(),
          description: z.string().max(5000).optional(),
          placeholder: shortText.optional(),
          options: z.array(shortText).optional(),
          allowOther: z.boolean().optional(),
        })
        .superRefine((question, ctx) => {
          if (
            needsOptions(question.type) &&
            (!question.options?.length || question.options.some((option) => !option))
          ) {
            ctx.addIssue({ code: 'custom', path: ['options'], message: '선택지를 하나 이상 넣어 주세요.' });
          }
        }),
    )
    .superRefine((questions, ctx) => {
      const ids = new Set<string>();
      questions.forEach((question, index) => {
        if (ids.has(question.id))
          ctx.addIssue({ code: 'custom', path: [index, 'id'], message: '질문 ID가 중복되었습니다.' });
        ids.add(question.id);
      });
    }),
});

export type ApplicationFormValues = z.infer<typeof applicationFormSchema>;

export function toFormValues(
  response: ApplicationFormResponse,
  fallback: { title: string; description: string },
): ApplicationFormValues {
  return {
    title: response.title === fallback.title ? '' : response.title,
    description: response.description === fallback.description ? '' : (response.description ?? ''),
    questions: response.questions.map((question) => ({
      ...question,
      type: question.type.toLowerCase() as ApplicationQuestionType,
      description: question.description ?? undefined,
      placeholder: question.placeholder ?? undefined,
      options: question.options ?? undefined,
      allowOther: question.allowOther ?? undefined,
    })),
  };
}

export function toPayload(values: ApplicationFormValues) {
  const parsed = applicationFormSchema.parse(values);
  return {
    ...parsed,
    questions: parsed.questions.map((question): ApiQuestion => ({
      id: question.id,
      label: question.label,
      type: question.type.toUpperCase() as ApiQuestion['type'],
      required: question.required,
      description: question.description,
      placeholder: needsOptions(question.type) ? undefined : question.placeholder,
      options: needsOptions(question.type) ? question.options : undefined,
      allowOther: allowsOther(question.type) ? question.allowOther : undefined,
    })),
  };
}
