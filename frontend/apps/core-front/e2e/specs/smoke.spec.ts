import { expect, test } from '@playwright/test';

test.describe('홈', () => {
  test('페이지 로드', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/StudyClub/i);
  });
});

test.describe('스터디 목록', () => {
  test('페이지 이동', async ({ page }) => {
    await page.goto('/ko/studies');
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('이벤트 목록', () => {
  test('페이지 이동', async ({ page }) => {
    await page.goto('/ko/events');
    await expect(page.locator('main')).toBeVisible();
  });
});
