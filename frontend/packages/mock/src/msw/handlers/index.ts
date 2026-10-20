import { registerHandlers, type MockHandlerGroup } from '../utils';
import { accountsHandlers } from './accounts';
import { authMeHandlers, discordLinkHandlers } from './auth';
import { notificationTemplatesHandlers } from './notification-templates';
import { notificationsHandlers } from './notifications';
import { rolePermissionsHandlers } from './role-permissions';
import { meStudiesHandlers } from './me';
import { studyMeetingsHandlers } from './meetings';
import { attendanceHandlers } from './attendance';
import { studiesHandlers, adminStudiesHandlers, adminStudyProgramsHandlers } from './studies';

export { registerHandlers, type MockHandlerGroup } from '../utils';
export { studiesHandlers, adminStudiesHandlers, adminStudyProgramsHandlers } from './studies';
export { accountsHandlers, mockAdminAccounts } from './accounts';
export { authMeHandlers, discordLinkHandlers, MOCK_DISCORD_LINKED_KEY } from './auth';
export { rolePermissionsHandlers, mockRolePermissions } from './role-permissions';
export { meStudiesHandlers } from './me';
export { studyMeetingsHandlers } from './meetings';
export { attendanceHandlers } from './attendance';
export { notificationTemplatesHandlers, mockNotificationTemplates } from './notification-templates';
export { notificationsHandlers, resetMockNotifications } from './notifications';

export const mockHandlerGroups: MockHandlerGroup[] = [
  studiesHandlers,
  adminStudiesHandlers,
  adminStudyProgramsHandlers,
  accountsHandlers,
  authMeHandlers,
  discordLinkHandlers,
  rolePermissionsHandlers,
  meStudiesHandlers,
  studyMeetingsHandlers,
  attendanceHandlers,
  notificationTemplatesHandlers,
  notificationsHandlers,
];

export const handlers = mockHandlerGroups.flatMap((group) =>
  registerHandlers(group.handlers.map((h) => ({ ...h, preset: h.presets[0] })))
);
