import { z } from 'zod';

export const sessionUserSchema = z.object({
  id: z.number(),
  email: z.string(),
  nickname: z.union([z.string(), z.null()]),
  picture: z.union([z.string(), z.null()]),
  role: z.string(),
  timeZone: z.union([z.string(), z.null()]).optional(),
  onboardingCompletedAt: z.union([z.string(), z.null()]).optional(),
});

export const tokenResponseSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresIn: z.number().optional(),
  refreshToken: z.string().nullable().optional(),
  refreshTokenExpiresIn: z.number().optional(),
});
export const socialLoginResponseSchema = tokenResponseSchema.extend({
  account: sessionUserSchema,
  suggestedNickname: z.string().nullable().optional(),
});

export const browserLoginResponseSchema = socialLoginResponseSchema.pick({ account: true, suggestedNickname: true });
