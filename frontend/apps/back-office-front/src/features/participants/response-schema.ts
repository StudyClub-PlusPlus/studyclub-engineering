import { z } from 'zod';

export const participantsResponseSchema = z.union([
  z.null(),
  z.object({
    studyId: z.number(),
    participantCount: z.number(),
    recruitmentCapacity: z.union([z.null(), z.number()]),
    ownerCaptain: z.union([z.null(), z.object({ accountId: z.number(), nickname: z.string() })]),
    groups: z.array(
      z.object({
        groupId: z.number(),
        name: z.string(),
        isDefault: z.boolean(),
        canDelete: z.boolean(),
      }),
    ),
    participants: z.array(
      z.object({
        participantId: z.number(),
        accountId: z.number(),
        nickname: z.string(),
        discordNickname: z.union([z.null(), z.string()]),
        email: z.string(),
        timeZone: z.union([z.null(), z.string()]),
        // 서버 배포 전 응답에는 이 칸이 없다 — 빈 배열로 읽는다
        availableDays: z.array(z.string()).optional().default([]),
        groupId: z.number(),
        participantRole: z.union([z.literal('LEADER'), z.literal('MEMBER')]),
        status: z.union([z.literal('ACTIVE'), z.literal('PAUSED'), z.literal('WITHDRAWN'), z.literal('COMPLETED')]),
        captain: z.boolean(),
        joinedAt: z.string(),
      }),
    ),
  }),
]);

export const groupAssignmentsResponseSchema = z.object({
  participants: z.array(
    z.object({
      participantId: z.number(),
      groupId: z.number(),
      participantRole: z.union([z.literal('LEADER'), z.literal('MEMBER')]),
    }),
  ),
});

export const ownerCaptainResponseSchema = z.object({
  studyId: z.number(),
  ownerCaptain: z.object({ accountId: z.number(), nickname: z.string() }),
});

export const groupSchema = z.object({
  groupId: z.number(),
  name: z.string(),
});

export const emptyResponseSchema = z.null();
