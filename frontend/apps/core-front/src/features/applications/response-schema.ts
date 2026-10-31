import { z } from 'zod';

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
      placeholder: z.string().optional(),
      description: z.string().optional(),
      options: z.array(z.string()).optional(),
      allowOther: z.boolean().optional(),
    }),
  ),
});
