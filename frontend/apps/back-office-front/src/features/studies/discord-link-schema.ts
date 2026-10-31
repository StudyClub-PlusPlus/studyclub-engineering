import { z } from 'zod';

export const discordLinkSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '디스코드 이름을 입력해 주세요.')
    .max(96, '디스코드 이름은 96자 이하로 입력해 주세요.'),
});

export type DiscordLinkValues = z.infer<typeof discordLinkSchema>;
