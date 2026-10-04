import { registerHandlers, type MockHandlerGroup } from '../utils';
import { accountsHandlers } from './accounts';
import { notificationTemplatesHandlers } from './notification-templates';
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
export { accountsHandlers, mockUsers } from './accounts';
export { notificationTemplatesHandlers, mockNotificationTemplates } from './notification-templates';

export const mockHandlerGroups: MockHandlerGroup[] = [
  studiesHandlers,
  adminStudiesHandlers,
  adminStudyProgramsHandlers,
  accountsHandlers,
  notificationTemplatesHandlers,
];

export const handlers = mockHandlerGroups.flatMap((group) =>
  registerHandlers(group.handlers.map((h) => ({ ...h, preset: h.presets[0] }))),
);
