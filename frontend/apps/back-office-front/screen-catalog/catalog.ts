import { authScreenStates } from './features/auth/login.meta';
import { studyScreenStates } from './features/studies/studies.meta';
import { pages } from './pages';
import type { ScreenCatalog, ScreenStateDef } from './types';

const screenStates: ScreenStateDef[] = [
  ...authScreenStates,
  ...studyScreenStates,
];

export const backOfficeScreenCatalog: ScreenCatalog = { pages, screenStates };

export function getRunnableScreenStates(): ScreenStateDef[] {
  return backOfficeScreenCatalog.screenStates.filter(
    (s) => !s.tags?.includes('excluded') && !s.deprecation,
  );
}
