import { z } from 'zod';

export const apiGroupMeetingsSchema = z.object({
  studyGroup: z.object({
    id: z.number(),
    name: z.string(),
    timezone: z.string(),
    startTime: z.union([z.null(), z.string()]),
    navigatorName: z.union([z.null(), z.string()]),
    rules: z.union([z.null(), z.string()]),
  }),
  me: z.object({
    participantId: z.union([z.null(), z.number()]),
    canEdit: z.boolean(),
  }),
  participants: z.array(
    z.object({
      participantId: z.number(),
      name: z.string(),
    }),
  ),
  meetings: z.array(
    z.object({
      id: z.number(),
      type: z.union([z.literal('KICKOFF'), z.literal('REGULAR')]),
      number: z.number(),
      scheduledAt: z.string(),
      title: z.union([z.null(), z.string()]),
      presenter1: z.union([
        z.null(),
        z.object({
          participantId: z.number(),
          name: z.string(),
          active: z.union([z.undefined(), z.boolean()]).optional(),
        }),
      ]),
      presenter2: z.union([
        z.null(),
        z.object({
          participantId: z.number(),
          name: z.string(),
          active: z.union([z.undefined(), z.boolean()]).optional(),
        }),
      ]),
      started: z.boolean(),
    }),
  ),
});

/** 반 수정(`PATCH /api/admin/studies/{id}/groups/{groupId}`) 응답 — 200 과 수정한 반. 서버 `StudyGroupUpdateResponse`. */
export const groupUpdateResponseSchema = z.object({
  groupId: z.number(),
  name: z.string(),
  daysOfWeek: z.union([z.null(), z.array(z.string())]),
  startTime: z.union([z.null(), z.string()]),
  timezone: z.union([z.null(), z.string()]),
});

export const emptyResponseSchema = z.null();
