import { homeScreenStates } from './features/home/home.meta';
import { studyScreenStates } from './features/studies/studyList.meta';
import { authScreenStates } from './features/auth/login.meta';
import { pages } from './pages';
import type { ScreenCatalog, ScreenStateDef } from './types';

const screenStates: ScreenStateDef[] = [
  ...homeScreenStates,
  ...studyScreenStates,
  ...authScreenStates,
];

export const coreScreenCatalog: ScreenCatalog = { pages, screenStates };

export function getRunnableScreenStates(): ScreenStateDef[] {
  return coreScreenCatalog.screenStates.filter(
    (s) => !s.tags?.includes('excluded') && !s.deprecation,
  );
}
