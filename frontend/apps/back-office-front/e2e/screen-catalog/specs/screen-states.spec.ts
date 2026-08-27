import { test } from '@playwright/test';
import { getRunnableScreenStates } from '../../../screen-catalog/catalog';
import { resolveViewports } from '../../../screen-catalog/viewports';
import { runScreenState } from '../runScreenState';

const screenStates = getRunnableScreenStates();

for (const state of screenStates) {
  const viewports = resolveViewports(state.viewports);

  for (const viewport of viewports) {
    test(`${state.id} [${viewport}]`, async ({ page }, testInfo) => {
      await runScreenState(page, testInfo, state, viewport);
    });
  }
}
