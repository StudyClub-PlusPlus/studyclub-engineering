import type { Page, TestInfo } from '@playwright/test';
import { expect } from '@playwright/test';
import type { ScreenStateDef } from '../../screen-catalog/types';
import { VIEWPORTS, resolveViewports } from '../../screen-catalog/viewports';
import { executeSteps } from './adapters/screenStep';
import { waitForPageStable } from './waitForPageStable';

export async function runScreenState(
  page: Page,
  testInfo: TestInfo,
  state: ScreenStateDef,
  viewport: ReturnType<typeof resolveViewports>[number],
): Promise<void> {
  const { recipe, assertions, screenshot } = state;

  // 1. 뷰포트 설정
  await page.setViewportSize(VIEWPORTS[viewport]);

  // 2. 타겟 페이지 이동 (BO_DEV_BYPASS_AUTH=1 가 설정된 dev 서버를 향함)
  await page.goto(recipe.render.url, { waitUntil: 'domcontentloaded' });

  // 3. 추가 스텝 실행
  if (recipe.steps && recipe.steps.length > 0) {
    await executeSteps(page, recipe.steps);
  }

  // 4. 페이지 안정화 대기
  await waitForPageStable(page);

  // 5. assertions
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

  // 6. 스크린샷 (visual regression)
  const snapshotName = `${state.id}--${viewport}.png`;
  await expect(page).toHaveScreenshot(snapshotName, {
    fullPage: screenshot?.fullPage ?? false,
    clip: screenshot?.clip,
    maxDiffPixelRatio: 0.02,
  });
}
