import { z } from 'zod';

export const accountSchema = z.object({
  id: z.number(),
  email: z.string(),
  nickname: z.union([z.string(), z.null()]),
  picture: z.union([z.string(), z.null()]),
  role: z.string(),
  createdAt: z.string().optional(),
  timeZone: z.union([z.string(), z.null()]),
  onboardingCompletedAt: z.union([z.string(), z.null()]),
  discordLinked: z.union([z.boolean(), z.null()]).optional(),
  discordHandle: z.union([z.string(), z.null()]).optional(),
});
