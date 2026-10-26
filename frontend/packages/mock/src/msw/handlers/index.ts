import { registerHandlers, type MockHandlerGroup } from "../utils";
import { accountsHandlers } from "./accounts";
import { adminStatsHandlers } from "./admin-stats";
import { meDiscordHandlers, discordLinkHandlers } from "./discord";
import { notificationTemplatesHandlers } from "./notification-templates";
import { notificationsHandlers } from "./notifications";
import { studyNoticesHandlers } from "./notices";
import { rolePermissionsHandlers } from "./role-permissions";
import { meStudiesHandlers } from "./me";
import { studyMeetingsHandlers } from "./meetings";
import { attendanceHandlers } from "./attendance";
import { adminParticipantsHandlers } from "./participants";
import {
  studiesHandlers,
  adminStudiesHandlers,
  adminStudyProgramsHandlers,
} from "./studies";

export { registerHandlers, type MockHandlerGroup } from "../utils";
export {
  studiesHandlers,
  adminStudiesHandlers,
  adminStudyProgramsHandlers,
} from "./studies";
export { accountsHandlers, mockAdminAccounts } from "./accounts";
export { adminStatsHandlers } from "./admin-stats";
export {
  meDiscordHandlers,
  discordLinkHandlers,
  MOCK_DISCORD_LINKED_KEY,
} from "./discord";
export {
  rolePermissionsHandlers,
  mockRolePermissions,
} from "./role-permissions";
export { meStudiesHandlers } from "./me";
export { studyMeetingsHandlers } from "./meetings";
export { attendanceHandlers } from "./attendance";
export { adminParticipantsHandlers } from "./participants";
export {
  notificationTemplatesHandlers,
  mockNotificationTemplates,
} from "./notification-templates";
export { notificationsHandlers, resetMockNotifications } from "./notifications";
export { studyNoticesHandlers, resetMockNotices } from "./notices";

export const mockHandlerGroups: MockHandlerGroup[] = [
  studiesHandlers,
  adminStudiesHandlers,
  adminStudyProgramsHandlers,
  accountsHandlers,
  meDiscordHandlers,
  discordLinkHandlers,
  rolePermissionsHandlers,
  meStudiesHandlers,
  studyMeetingsHandlers,
  studyNoticesHandlers,
  attendanceHandlers,
  adminParticipantsHandlers,
  notificationTemplatesHandlers,
  notificationsHandlers,
  adminStatsHandlers,
];

export const handlers = mockHandlerGroups.flatMap((group) =>
  registerHandlers(group.handlers.map((h) => ({ ...h, preset: h.presets[0] }))),
);
