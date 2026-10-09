import { expect, test } from '@playwright/test';

test('신청 폼 편집 후 한 번의 클릭으로 저장하고 다시 불러온다', async ({ page, context, baseURL }) => {
  let questions: unknown[] = [];
  let savedTitle = '신청 폼 테스트';
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.addInitScript(() => {
    localStorage.setItem(
      'msw-handler-config',
      JSON.stringify({
        'GET:/api/admin/studies/:id': { enabled: false, presetLabel: '정상' },
        'GET:/api/admin/studies/:id/application-form': { enabled: false, presetLabel: '정상' },
        'PUT:/api/admin/studies/:id/application-form': { enabled: false, presetLabel: '성공' },
      }),
    );
  });
  await context.addCookies([{ name: 'bo_access_token', value: 'test-only', url: baseURL! }]);
  await context.route('**/api/admin/studies/106**', async (route) => {
    if (route.request().url().endsWith('/application-form')) {
      if (route.request().method() === 'PUT') {
        const payload = route.request().postDataJSON();
        questions = payload.questions;
        savedTitle = payload.title;
      }
      await route.fulfill({ json: { studyId: 106, title: savedTitle, description: '함께 공부합니다.', questions } });
    } else {
      await route.fulfill({
        json: {
          id: 106,
          programId: 1,
          title: '신청 폼 테스트',
          oneLineSummary: '함께 공부합니다.',
          category: 'AI_ML',
          studyKind: 'STUDY',
          status: 'DRAFT',
          recruitStatus: null,
          capacity: 12,
        },
      });
    }
  });
  await page.goto('/studies/106?tab=form');
  await page.getByRole('button', { name: '질문 추가', exact: true }).click();
  await page.getByRole('textbox', { name: '질문 제목', exact: true }).fill('선호하는 분야');
  await page.getByRole('combobox', { name: '질문 타입', exact: true }).selectOption('checkbox');
  await page.getByRole('textbox', { name: '선택지 1', exact: true }).fill('시스템 설계');
  await page.getByRole('textbox', { name: '선택지 1', exact: true }).press('Enter');
  await page.getByRole('textbox', { name: '선택지 2', exact: true }).fill('분산 시스템');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '저장되었습니다.' })).toBeVisible();
  expect(questions).toMatchObject([
    { label: '선호하는 분야', type: 'CHECKBOX', options: ['시스템 설계', '분산 시스템'] },
  ]);
  await page.reload();
  await expect(page.getByText('선호하는 분야')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
