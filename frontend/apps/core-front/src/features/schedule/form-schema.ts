import { z } from 'zod';

import { planDraft, type ProtoMeeting } from './meetings';

const meetingDraftFields = z.object({
  date: z.string().refine((v) => !v || z.iso.date().safeParse(v).success, '올바른 일자를 입력해 주세요.'),
  time: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/, '올바른 시각을 입력해 주세요.'),
  title: z.string(),
  repeat: z.enum(['none', 'daily', 'weekly']),
  until: z.string().refine((v) => !v || z.iso.date().safeParse(v).success, '올바른 종료일을 입력해 주세요.'),
  weekdays: z.array(z.number().int().min(0).max(6)),
  occurrences: z.record(z.string(), z.string()).optional(),
});

export type MeetingFormValues = z.infer<typeof meetingDraftFields>;

/** 일정 중복·DST·반복 규칙은 미리보기와 같은 도메인 검사기를 사용한다. */
export function meetingFormSchema(existing: ProtoMeeting[], inputZone: string, calendarZone: string) {
  return meetingDraftFields.superRefine((draft, context) => {
    // 날짜 형식 오류를 도메인 시간대 계산에 전달하지 않는다.
    if (!meetingDraftFields.safeParse(draft).success) return;
    const { errors } = planDraft(draft, existing, inputZone, new Date(), calendarZone);
    for (const [field, message] of Object.entries(errors)) {
      if (message) context.addIssue({ code: 'custom', path: [field], message });
    }
  });
}
