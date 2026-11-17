import { expect, test, type Page } from '@playwright/test';

import { stubApiMe } from '../stubApiMe';

// 마이페이지 디스코드 줄 (crew-edit-profile §4). 연동 상태와 연동·해제 응답은 개발 서버 MSW 목이 답한다
// 목 핸들러 키는 앱이 읽는 API 주소를 앞에 붙인다. 테스트 프로세스는 그 값을 모를 수 있어 쓸 만한 키를 다 넣는다
const DELETE_KEYS = [
  '',
  process.env.NEXT_PUBLIC_API_BASE_URL,
  'https://api.studyclub-plusplus.com',
  'https://api.studyclub.life',
  'http://localhost:28080',
]
  .filter((base): base is string => base !== undefined)
  .map((base) => `DELETE:${base}/api/me/discord/link`);

async function openMyPage(page: Page, { linked, deletePreset }: { linked: boolean; deletePreset?: string }) {
  await stubApiMe(page);
  // 미들웨어는 로그인 쿠키가 있는지만 본다
  await page.context().addCookies([{ name: 'sc_access_token', value: 'e2e', url: 'http://localhost:4700' }]);
  await page.addInitScript(
    ({ linked, deletePreset, keys }) => {
      localStorage.setItem(
        'sc_user',
        JSON.stringify({
          id: 1,
          email: 'test@test.com',
          nickname: '테스트크루',
          picture: null,
          role: 'MEMBER',
          timeZone: 'Asia/Seoul',
          onboardingCompletedAt: '2026-01-01T00:00:00Z',
        }),
      );
      localStorage.setItem('msw-discord-linked', String(linked));
      if (deletePreset) {
        const cfg = { presetLabel: deletePreset, enabled: true };
        localStorage.setItem('msw-handler-config', JSON.stringify(Object.fromEntries(keys.map((k) => [k, cfg]))));
      }
    },
    { linked, deletePreset, keys: DELETE_KEYS },
  );
  await page.goto('/ko/my');
}

test.describe('마이페이지 디스코드 연결 (crew-edit-profile)', () => {
  test('미연결이면 「연결 안 됨」과 「연결하기」, 연결하면 @계정 이름과 「연결 해제」', async ({ page }) => {
    await openMyPage(page, { linked: false });
    await expect(page.getByText('연결 안 됨')).toBeVisible();

    await page.getByRole('button', { name: '연결하기' }).click();

    await expect(page.getByText('@jiwon_dev')).toBeVisible();
    await expect(page.getByRole('button', { name: '연결 해제' })).toBeVisible();
  });

  test('해제하면 미연결로 돌아간다', async ({ page }) => {
    await openMyPage(page, { linked: true });
    await page.getByRole('button', { name: '연결 해제' }).click();

    await expect(page.getByRole('button', { name: '연결하기' })).toBeVisible();
    await expect(page.getByText('@jiwon_dev')).toHaveCount(0);
  });

  test('참여 중이면 연결을 유지하고 할 일과 내 스터디 링크를 보여 준다', async ({ page }) => {
    await openMyPage(page, { linked: true, deletePreset: '참여 중이라 해제 불가 (409)' });
    await page.getByRole('button', { name: '연결 해제' }).click();

    await expect(page.getByText('참여 중단은 캡틴에게 문의해 주세요.')).toBeVisible();
    await expect(page.getByRole('link', { name: '내 스터디 확인하기' })).toHaveAttribute('href', '/ko/my/joined');
    await expect(page.getByText('@jiwon_dev')).toBeVisible();
  });
});
