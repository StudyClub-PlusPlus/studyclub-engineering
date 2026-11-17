import type { Page } from '@playwright/test';

/**
 * 페이지 렌더가 안정될 때까지 대기한다.
 * DOMContentLoaded 후 알려진 로딩 표시를 기다리고 300ms 여유를 둔다.
 * 네트워크 완료·레이아웃 안정성을 보장하지 않으므로 상태별 assertion이 필요하다.
 */
export async function waitForPageStable(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');

  // 로딩 인디케이터가 있다면 사라질 때까지 대기
  const spinner = page.locator('[data-testid="loading"], [aria-label="로딩 중"]');
  if ((await spinner.count()) > 0) {
    await spinner
      .first()
      .waitFor({ state: 'hidden', timeout: 10_000 })
      .catch(() => {});
  }

  // 렌더링 여유 시간
  await page.waitForTimeout(300);
}
