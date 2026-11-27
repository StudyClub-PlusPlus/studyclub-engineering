import { authScreenStates } from './features/auth/login.meta';
import { onboardingScreenStates } from './features/auth/onboarding.meta';
import { homeScreenStates } from './features/home/home.meta';
import { joinedRetroScreenStates } from './features/my/joinedRetro.meta';
import { joinedScheduleScreenStates } from './features/my/joinedSchedule.meta';
import { joinedStudiesScreenStates } from './features/my/joinedStudies.meta';
import { feedbackScreenStates } from './features/prd/feedback.meta';
import { prdScreenStates } from './features/prd/states.meta';
import { siteScreenStates } from './features/site/site.meta';
import { studyScreenStates } from './features/studies/studyList.meta';
import { pages } from './pages';
import type { ScreenCatalog, ScreenStateDef } from './types';

const screenStates: ScreenStateDef[] = [
  ...homeScreenStates,
  ...studyScreenStates,
  ...siteScreenStates,
  ...authScreenStates,
  ...onboardingScreenStates,
  ...joinedStudiesScreenStates,
  ...joinedScheduleScreenStates,
  ...joinedRetroScreenStates,
  ...prdScreenStates,
  ...feedbackScreenStates,
];

export const coreScreenCatalog: ScreenCatalog = { pages, screenStates };

export function getRunnableScreenStates(): ScreenStateDef[] {
  return coreScreenCatalog.screenStates.filter((s) => !s.tags?.includes('excluded') && !s.deprecation);
}
