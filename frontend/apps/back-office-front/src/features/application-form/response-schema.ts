import { z } from 'zod';

export const applicationFormResponseSchema = z.object({
  studyId: z.number(),
  title: z.string(),
  description: z.union([z.null(), z.string()]),
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
      description: z.union([z.undefined(), z.null(), z.string()]).optional(),
      placeholder: z.union([z.undefined(), z.null(), z.string()]).optional(),
      options: z.union([z.undefined(), z.null(), z.array(z.string())]).optional(),
      allowOther: z.union([z.undefined(), z.null(), z.boolean()]).optional(),
    }),
  ),
});
