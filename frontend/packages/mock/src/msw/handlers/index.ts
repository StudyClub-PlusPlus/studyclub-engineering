import { registerHandlers, type MockHandlerGroup } from '../utils';
import { accountsHandlers } from './accounts';
import { notificationTemplatesHandlers } from './notification-templates';
import { notificationsHandlers } from './notifications';
import { rolePermissionsHandlers } from './role-permissions';
import {
  studiesHandlers,
  adminStudiesHandlers,
  adminStudyProgramsHandlers,
} from './studies';

export { registerHandlers, type MockHandlerGroup } from '../utils';
export {
  studiesHandlers,
  adminStudiesHandlers,
  adminStudyProgramsHandlers,
} from './studies';
export { accountsHandlers, mockAdminAccounts } from './accounts';
export { rolePermissionsHandlers, mockRolePermissions } from './role-permissions';
export { notificationTemplatesHandlers, mockNotificationTemplates } from './notification-templates';
export { notificationsHandlers, resetMockNotifications } from './notifications';

export const mockHandlerGroups: MockHandlerGroup[] = [
  studiesHandlers,
  adminStudiesHandlers,
  adminStudyProgramsHandlers,
  accountsHandlers,
  rolePermissionsHandlers,
  notificationTemplatesHandlers,
  notificationsHandlers,
];

export const handlers = mockHandlerGroups.flatMap((group) =>
  registerHandlers(group.handlers.map((h) => ({ ...h, preset: h.presets[0] }))),
);
