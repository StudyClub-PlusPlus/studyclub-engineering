import { z } from 'zod';

export const applicationResultsResponseSchema = z.object({
  respondentCount: z.number(),
  questions: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      type: z.string(),
      options: z.union([z.undefined(), z.null(), z.array(z.string())]).optional(),
      allowOther: z.union([z.undefined(), z.null(), z.boolean()]).optional(),
    }),
  ),
  applications: z.array(
    z.object({
      id: z.number(),
      recruitmentId: z.number(),
      discordNickname: z.union([z.null(), z.string()]),
      email: z.union([z.null(), z.string()]),
      answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
    }),
  ),
});
