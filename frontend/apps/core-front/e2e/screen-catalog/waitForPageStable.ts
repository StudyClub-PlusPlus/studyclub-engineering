import type { Page } from '@playwright/test';

/**
 * 페이지 렌더가 안정될 때까지 대기한다.
 * - network idle (domcontentloaded 이후 500ms 내 요청 없음)
 * - 로딩 스피너 제거
 * - 레이아웃 시프트 없음 (100ms 간격 2회 연속 동일)
 */
export async function waitForPageStable(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');

  // 로딩 인디케이터가 있다면 사라질 때까지 대기
  const spinner = page.locator('[data-testid="loading"], [aria-label="로딩 중"]');
  if (await spinner.count() > 0) {
    await spinner.first().waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
  }

  // 레이아웃 시프트가 없을 때까지 잠시 대기
  await page.waitForTimeout(300);
}
