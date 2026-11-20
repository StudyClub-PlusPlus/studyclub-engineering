import { expect, it } from 'vitest';

import { apiStudyBoardSchema } from './response-schema';
import { prdDashboardStates } from '../../../screen-catalog/features/prd/dashboard.meta';

it('dashboard catalog board responses include the requested server view', () => {
  const boards = prdDashboardStates[0].recipe.api!.filter((fixture) => fixture.path.endsWith('/study-board'));
  expect(boards).toHaveLength(2);
  for (const board of boards) {
    expect(apiStudyBoardSchema.parse(board.json).view).toBe(board.query?.view);
  }
});
