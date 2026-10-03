import { registerHandlers, type MockHandlerGroup } from '../utils';
import { accountsHandlers } from './accounts';
import { notificationTemplatesHandlers } from './notification-templates';
import { studiesHandlers } from './studies';

export { registerHandlers, type MockHandlerGroup } from '../utils';
export { studiesHandlers } from './studies';
export { accountsHandlers, mockUsers } from './accounts';
export { notificationTemplatesHandlers, mockNotificationTemplates } from './notification-templates';

export const mockHandlerGroups: MockHandlerGroup[] = [
  studiesHandlers,
  accountsHandlers,
  notificationTemplatesHandlers,
];

export const handlers = mockHandlerGroups.flatMap((group) =>
  registerHandlers(group.handlers.map((h) => ({ ...h, preset: h.presets[0] }))),
);
