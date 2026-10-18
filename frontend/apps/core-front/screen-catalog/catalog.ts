import { authScreenStates } from './features/auth/login.meta';
import { homeScreenStates } from './features/home/home.meta';
import { joinedScheduleScreenStates } from './features/my/joinedSchedule.meta';
import { joinedStudiesScreenStates } from './features/my/joinedStudies.meta';
import { studyScreenStates } from './features/studies/studyList.meta';
import { pages } from './pages';
import type { ScreenCatalog, ScreenStateDef } from './types';

const screenStates: ScreenStateDef[] = [
  ...homeScreenStates,
  ...studyScreenStates,
  ...authScreenStates,
  ...joinedStudiesScreenStates,
  ...joinedScheduleScreenStates,
];

export const coreScreenCatalog: ScreenCatalog = { pages, screenStates };

export function getRunnableScreenStates(): ScreenStateDef[] {
  return coreScreenCatalog.screenStates.filter((s) => !s.tags?.includes('excluded') && !s.deprecation);
}
