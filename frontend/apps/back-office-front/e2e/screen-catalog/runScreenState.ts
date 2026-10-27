import type { Page, TestInfo } from '@playwright/test';
import { expect } from '@playwright/test';

import { executeSteps } from './adapters/screenStep';
import { waitForPageStable } from './waitForPageStable';
import type { ScreenStateDef } from '../../screen-catalog/types';
import { VIEWPORTS, resolveViewports } from '../../screen-catalog/viewports';

export async function runScreenState(
  page: Page,
  testInfo: TestInfo,
  state: ScreenStateDef,
  viewport: ReturnType<typeof resolveViewports>[number],
): Promise<void> {
  const { recipe, assertions, screenshot } = state;

  // 1. 뷰포트 설정
  await page.setViewportSize(VIEWPORTS[viewport]);

  // 2. 브라우저 저장소 시드 — 페이지 스크립트보다 먼저 localStorage 에 넣는다 (서버 API 가 없는 화면의 데이터)
  if (recipe.storage && recipe.storage.length > 0) {
    await page.addInitScript((seeds) => {
      for (const { key, value } of seeds) localStorage.setItem(key, JSON.stringify(value));
    }, recipe.storage);
  }

  // 3. 타겟 페이지 이동 (BO_DEV_BYPASS_AUTH=1 가 설정된 dev 서버를 향함)
  await page.goto(recipe.render.url, { waitUntil: 'domcontentloaded' });

  // 4. 추가 스텝 실행
  if (recipe.steps && recipe.steps.length > 0) {
    await executeSteps(page, recipe.steps);
  }

  // 5. 페이지 안정화 대기
  await waitForPageStable(page);

  // 6. assertions
  if (assertions) {
    for (const sel of assertions.visible ?? []) {
      await expect(page.locator(sel).first()).toBeVisible();
    }
    for (const sel of assertions.hidden ?? []) {
      await expect(page.locator(sel).first()).toBeHidden();
    }
    for (const [sel, text] of Object.entries(assertions.text ?? {})) {
      await expect(page.locator(sel).first()).toContainText(text);
    }
  }

  // 7. 스크린샷 (visual regression)
  const snapshotName = `${state.id}--${viewport}.png`;
  await expect(page).toHaveScreenshot(snapshotName, {
    fullPage: screenshot?.fullPage ?? false,
    clip: screenshot?.clip,
    maxDiffPixelRatio: 0.02,
  });
}
