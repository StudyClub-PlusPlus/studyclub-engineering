import {
  apiAdminAccountPageSchema,
  apiDiscordRevealSchema,
  apiEmailRevealSchema,
  apiRoleChangeSchema,
  apiRolePermissionsSchema,
} from '@/features/users/response-schema';
import type { SystemRole, UserFilter } from '@/features/users/types';
import { http, qs } from '@/lib/http';

export function usersPath(filter: UserFilter): string {
  return `/api/admin/users${qs({
    role: filter.role === 'ALL' ? undefined : filter.role,
    q: filter.q?.trim(),
    offset: filter.offset,
    limit: filter.limit,
  })}`;
}

export const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function users(filter: UserFilter) {
  return http(usersPath(filter), apiAdminAccountPageSchema);
}

export function revealEmail(accountId: number) {
  return http(`/api/admin/users/${accountId}/email-reveals`, apiEmailRevealSchema, { method: 'POST' });
}

export function changeAccountRole(accountId: number, systemRole: SystemRole) {
  return http(`/api/admin/users/${accountId}/system-role`, apiRoleChangeSchema, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({ systemRole }),
  });
}

export function revealDiscord(accountId: number) {
  return http(`/api/admin/users/${accountId}/discord-reveals`, apiDiscordRevealSchema, { method: 'POST' });
}

export function rolePermissions() {
  return http('/api/admin/role-permissions', apiRolePermissionsSchema);
}
