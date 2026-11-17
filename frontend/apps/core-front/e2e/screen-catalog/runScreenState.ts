import type { Page, TestInfo } from '@playwright/test';
import { expect } from '@playwright/test';

import { stubApiFixtures } from './adapters/apiFixtures';
import { seedBrowserStorage } from './adapters/browserStorage';
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

  // 날짜 의존 일정·발표 신청 가능 상태를 기준 이미지와 동일하게 재현한다.
  await page.clock.setFixedTime(new Date('2026-10-31T03:00:00Z'));

  // 1. 뷰포트 설정
  await page.setViewportSize(VIEWPORTS[viewport]);

  // 2. 로컬스토리지 시드 (navigate 전에 origin을 확립해야 하므로 선 이동 후 주입)
  if (recipe.storage && recipe.storage.length > 0) {
    await seedBrowserStorage(page, recipe.storage);
  }

  // 2-1. API 고정 응답 (MSW 목에 없는 API 를 로컬 백엔드 상태와 상관없이 고정한다)
  if (recipe.api && recipe.api.length > 0) {
    await stubApiFixtures(page, recipe.api);
  }

  // 3. 타겟 페이지 이동
  await page.goto(recipe.render.url, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new URL(recipe.render.url, testInfo.project.use.baseURL!).href);

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
  // Next 개발 도구 말풍선(「N」 · 「1 Insight」)은 Next 판마다 글자가 바뀐다 — 화면 비교에서 뺀다
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  const snapshotName = `${state.id}--${viewport}.png`;
  await expect(page).toHaveScreenshot(snapshotName, {
    fullPage: screenshot?.fullPage ?? false,
    clip: screenshot?.clip,
    maxDiffPixelRatio: 0.02,
  });
}
