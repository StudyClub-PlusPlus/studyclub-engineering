import { expect, test } from '@playwright/test';

test('진행 시작일이 모집 마감일보다 빠르면 등록을 막는다', async ({ page }) => {
  let createRequests = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/admin/studies') {
      createRequests += 1;
    }
  });

  await page.goto('/studies?new=1');
  await expect(page.getByRole('dialog', { name: '스터디 등록' })).toBeVisible();

  await page.getByRole('textbox', { name: '제목', exact: true }).fill('날짜 검증 스터디');
  await page.getByRole('textbox', { name: '한 줄 소개', exact: true }).fill('모집 마감 후에 시작합니다.');
  await page.getByRole('combobox', { name: '카테고리', exact: true }).selectOption('DATA');
  await page.locator('#deadline').fill('2026-11-10');

  const startAt = page.locator('#startAt');
  await expect(startAt).toHaveAttribute('min', '2026-11-10');
  await startAt.fill('2026-11-09');
  await page.getByRole('button', { name: '등록', exact: true }).click();

  await expect(page.getByText('진행 시작일은 모집 마감일보다 빠를 수 없어요.')).toBeVisible();
  await expect(startAt).toHaveAttribute('aria-invalid', 'true');
  expect(createRequests).toBe(0);
});
