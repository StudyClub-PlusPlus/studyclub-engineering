import { z } from 'zod';

export const authAccountSchema = z.object({
  id: z.number(),
  role: z.string(),
  email: z.string().optional(),
  nickname: z.string().nullable().optional(),
  picture: z.string().nullable().optional(),
  onboardingCompletedAt: z.string().nullable().optional(),
});
export const loginResponseSchema = z.object({ account: authAccountSchema });
export const socialLoginResponseSchema = loginResponseSchema.extend({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
  accessTokenExpiresIn: z.number().positive().optional(),
  refreshTokenExpiresIn: z.number().positive().optional(),
});
