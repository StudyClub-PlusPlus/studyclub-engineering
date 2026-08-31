import { expect, test } from '@playwright/test';

test.describe('로그인', () => {
  test('페이지 로드', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('대시보드', () => {
  test('페이지 로드', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();
  });
});
