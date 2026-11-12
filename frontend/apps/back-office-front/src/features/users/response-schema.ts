import { z } from 'zod';

export const apiAdminAccountPageSchema = z.object({
  items: z.array(
    z.object({
      id: z.number(),
      name: z.union([z.null(), z.string()]),
      maskedEmail: z.string(),
      systemRole: z.union([z.literal('MEMBER'), z.literal('ADMIN')]),
      navigatorOf: z.array(
        z.object({
          studyId: z.number(),
          title: z.string(),
        }),
      ),
      dormant: z.boolean(),
      joinedAt: z.string(),
      roleChangeBlockedReason: z.union([
        z.null(),
        z.literal('CANNOT_CHANGE_OWN_ROLE'),
        z.literal('LAST_ADMIN_REQUIRED'),
      ]),
      discordLinked: z.boolean(),
    }),
  ),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});

export const apiEmailRevealSchema = z.object({
  id: z.number(),
  email: z.string(),
});

export const apiRoleChangeSchema = z.object({
  id: z.number(),
  systemRole: z.union([z.literal('MEMBER'), z.literal('ADMIN')]),
});

export const apiDiscordRevealSchema = z.object({
  id: z.number(),
  discordHandle: z.string(),
});

export const apiRolePermissionsSchema = z.object({
  groups: z.array(
    z.object({
      scope: z.string(),
      roles: z.array(z.string()),
      permissions: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          allowedRoles: z.array(z.string()),
        }),
      ),
    }),
  ),
});
