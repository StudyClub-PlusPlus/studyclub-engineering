import { expect, test } from '@playwright/test';

test('신청 결과 질문별·응답자별 전환, 새로고침과 모바일 답변 조회', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'bo_access_token', value: 'test-only', url: baseURL! }]);
  await context.addInitScript(() =>
    localStorage.setItem(
      'msw-handler-config',
      JSON.stringify({
        'GET:/api/admin/studies/:id': { enabled: false, presetLabel: '정상' },
        'GET:http://localhost:8080/api/admin/studies/:id': { enabled: false, presetLabel: '정상' },
      }),
    ),
  );
  const requests: string[] = [];
  await context.route('**/api/admin/studies/20**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': baseURL!,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'GET,OPTIONS',
        },
      });
      return;
    }
    if (path.endsWith('/applications')) {
      requests.push(route.request().method());
      await route.fulfill({
        json: {
          respondentCount: 1,
          questions: [
            { id: 'choice', type: 'CHECKBOX', label: '관심 분야', options: ['백엔드', '프론트'], allowOther: true },
            { id: 'reason', type: 'TEXTAREA', label: '지원 사유' },
          ],
          applications: [
            {
              id: 1,
              recruitmentId: 7,
              discordNickname: '테스트크루',
              email: 'crew@example.com',
              answers: {
                choice: ['백엔드', '기타 답변 내용'],
                reason: '<img src=x onerror=alert(1)>\n긴 답변'.repeat(10),
              },
            },
          ],
        },
      });
    } else
      await route.fulfill({
        json: {
          id: 20,
          title: '신청 결과 테스트',
          category: 'AI_ML',
          studyKind: 'STUDY',
          status: 'OPEN',
          recruitStatus: 'RECRUITING',
          capacity: 10,
        },
      });
  });
  await page.goto('/studies/20?tab=results');
  await expect(page.getByText('응답자 1명')).toBeVisible();
  await expect(page.getByText('기타 답변 내용')).toBeVisible();
  await expect(page.getByText('crew@example.com')).toHaveCount(0);
  await page.getByRole('tab', { name: '응답자별' }).click();
  await expect(page).toHaveURL(/resultsView=individual/);
  await expect(page.getByText('테스트크루')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tab', { name: '응답자별' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('table img')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/application-results-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole('tab', { name: '질문별' }).click();
  await expect(page.getByRole('region', { name: '1. 관심 분야' })).toBeVisible();
  await page.screenshot({ path: 'test-results/application-results-summary.png', fullPage: true });
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every((method) => method === 'GET')).toBe(true);
});
