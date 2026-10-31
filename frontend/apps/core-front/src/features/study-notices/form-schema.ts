import { z } from 'zod';

import { effectiveChannels, noticeDraftSchema, pruneSelection } from './model';
import type { ApiNoticeCompose } from '@/features/study-notices/types';

const fields = noticeDraftSchema.omit({ selectedCount: true, channels: true }).extend({
  channels: z.array(z.enum(['EMAIL', 'DISCORD'])),
  participantIds: z.array(z.number().int().positive()),
});
export type NoticeFormValues = z.infer<typeof fields>;

export function noticeFormSchema(compose: ApiNoticeCompose) {
  return fields.superRefine((draft, context) => {
    if (!compose.canSend)
      context.addIssue({ code: 'custom', path: ['root'], message: '지금은 공지를 보낼 수 없습니다.' });
    if (!effectiveChannels(draft.channels, compose.discord.available).length) {
      context.addIssue({ code: 'custom', path: ['channels'], message: '보낼 곳을 하나 이상 골라 주세요.' });
    }
    if (!pruneSelection(new Set(draft.participantIds), compose.recipients).size) {
      context.addIssue({ code: 'custom', path: ['participantIds'], message: '받는 사람을 하나 이상 골라 주세요.' });
    }
  });
}
