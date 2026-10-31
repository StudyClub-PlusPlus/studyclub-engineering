import { z } from 'zod';

import { planDraft, RULES_MAX, validateKickoff, type Meeting } from '@/features/schedule/meetings';

const date = z.union([z.literal(''), z.iso.date('올바른 일자를 입력해 주세요.')]);
const time = z.union([z.literal(''), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '올바른 시각을 입력해 주세요.')]);
const weekdays = z.array(z.number().int().min(0).max(6));
const meetingFields = z.object({
  date,
  time,
  title: z.string(),
  repeat: z.enum(['none', 'daily', 'weekly']),
  until: date,
  weekdays,
});
export type MeetingValues = z.infer<typeof meetingFields>;
export function meetingSchema(existing: Meeting[], tz: string, now?: Date) {
  return meetingFields.superRefine((draft, ctx) => {
    if (!meetingFields.safeParse(draft).success) return;
    for (const [key, message] of Object.entries(planDraft(draft, existing, tz, now).errors)) {
      ctx.addIssue({ code: 'custom', path: [key === 'form' ? 'root' : key], message });
    }
  });
}
const kickoffFields = z.object({ date, time });
export type KickoffValues = z.infer<typeof kickoffFields>;
export function kickoffSchema(existing: Meeting[]) {
  return kickoffFields.superRefine((draft, ctx) => {
    if (!kickoffFields.safeParse(draft).success) return;
    for (const [key, message] of Object.entries(validateKickoff(draft, existing))) {
      ctx.addIssue({ code: 'custom', path: [key], message });
    }
  });
}
export const groupTimeSchema = z.object({
  weekdays: weekdays.min(1, '요일을 하나 이상 골라 주세요.'),
  time,
  tz: z.enum(['Asia/Seoul', 'America/Los_Angeles']),
});
export type GroupTimeValues = z.infer<typeof groupTimeSchema>;
export const groupRulesSchema = z.object({ rules: z.string().max(RULES_MAX) });
export type GroupRulesValues = z.infer<typeof groupRulesSchema>;
