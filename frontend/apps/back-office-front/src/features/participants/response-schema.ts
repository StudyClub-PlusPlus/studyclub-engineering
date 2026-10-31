import { z } from 'zod';

export const participantsResponseSchema = z.union([
  z.null(),
  z.object({
    studyId: z.number(),
    participantCount: z.number(),
    recruitmentCapacity: z.union([z.null(), z.number()]),
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
        regionGroup: z.union([z.null(), z.literal('KR'), z.literal('NA'), z.literal('ETC')]),
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

export const groupSchema = z.object({
  groupId: z.number(),
  name: z.string(),
});

export const emptyResponseSchema = z.null();
