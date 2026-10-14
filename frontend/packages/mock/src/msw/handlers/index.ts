import { registerHandlers, type MockHandlerGroup } from '../utils';
import { accountsHandlers } from './accounts';
import { adminStatsHandlers } from './admin-stats';
import { notificationTemplatesHandlers } from './notification-templates';
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
export { adminStatsHandlers } from './admin-stats';
export { rolePermissionsHandlers, mockRolePermissions } from './role-permissions';
export { notificationTemplatesHandlers, mockNotificationTemplates } from './notification-templates';

export const mockHandlerGroups: MockHandlerGroup[] = [
  studiesHandlers,
  adminStudiesHandlers,
  adminStudyProgramsHandlers,
  accountsHandlers,
  rolePermissionsHandlers,
  notificationTemplatesHandlers,
  adminStatsHandlers,
];

export const handlers = mockHandlerGroups.flatMap((group) =>
  registerHandlers(group.handlers.map((h) => ({ ...h, preset: h.presets[0] }))),
);
