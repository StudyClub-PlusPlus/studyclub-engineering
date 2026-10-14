import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// 로그인 + 온보딩 완료 사용자 세션 주입 헬퍼
async function loginAsCrew(page: Page) {
  await page.context().addCookies([
    {
      name: 'sc_access_token',
      value: 'dev-preview',
      domain: 'localhost',
      path: '/',
    },
  ]);
  await page.addInitScript(() => {
    localStorage.setItem(
      'sc_user',
      JSON.stringify({
        id: 1,
        email: 'crew@test.com',
        nickname: '테스트크루',
        picture: null,
        role: 'MEMBER',
        onboardingCompletedAt: '2026-08-01T00:00:00Z',
      }),
    );
  });
}

test.describe('내 스터디 (crew-joined-studies) — 비로그인 접근 제어', () => {
  test('비로그인 시 /ko/login 으로 리다이렉트되며 next 파라미터가 보존된다', async ({ page }) => {
    await page.goto('/ko/my/joined');
    await expect(page).toHaveURL(/\/ko\/login\?next=%2Fko%2Fmy%2Fjoined/);
  });
});

test.describe('내 스터디 (crew-joined-studies) — 기본 화면 및 인터랙션', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCrew(page);
  });

  test('로그인 회원 접속 시 제목, 주간 일정 그리드, 기본 "참여중" 탭이 렌더링된다', async ({ page }) => {
    await page.goto('/ko/my/joined');
    await expect(page.locator('h1')).toHaveText('내 스터디');

    // 주간 일정 영역 확인
    const weekHeading = page.locator('section h2');
    await expect(weekHeading).toBeVisible();
    await expect(weekHeading).toContainText(/일정/);

    // 참여 상태 탭 및 기본 '참여중' 탭 선택 확인
    const activeTab = page.getByRole('tab', { name: '참여중' });
    await expect(activeTab).toBeVisible();
    await expect(activeTab).toHaveAttribute('aria-selected', 'true');

    // 스터디 카드 목록 확인
    await expect(page.locator('ul li').first()).toBeVisible();
  });

  test('타임존 토글(KST ↔ PDT) 동작', async ({ page }) => {
    await page.goto('/ko/my/joined');

    const pdtBtn = page.getByRole('tab', { name: 'PDT' });
    const kstBtn = page.getByRole('tab', { name: 'KST' });

    await pdtBtn.click();
    await expect(pdtBtn).toHaveAttribute('aria-selected', 'true');

    await kstBtn.click();
    await expect(kstBtn).toHaveAttribute('aria-selected', 'true');
  });

  test('주간 일정 이전 주 / 다음 주 이동', async ({ page }) => {
    await page.goto('/ko/my/joined');

    const nextBtn = page.getByRole('button', { name: '다음 주' });
    await nextBtn.click();

    // 다음 주로 이동 시 제목이 '주간 일정'으로 변경
    await expect(page.locator('section h2')).toContainText('주간 일정');

    const prevBtn = page.getByRole('button', { name: '이전 주' });
    await prevBtn.click();
    // 다시 돌아오면 이번 주 일정
    await expect(page.locator('section h2')).toContainText('이번 주 일정');
  });

  test('참여 상태 탭 필터링 및 참여 종료 탭 완주 카드 확인', async ({ page }) => {
    await page.goto('/ko/my/joined');

    // 1. 시작전 탭
    await page.getByRole('tab', { name: '시작전' }).click();
    await expect(page.getByRole('tab', { name: '시작전' })).toHaveAttribute('aria-selected', 'true');

    // 2. 참여 종료 탭
    await page.getByRole('tab', { name: '참여 종료' }).click();
    await expect(page.getByRole('tab', { name: '참여 종료' })).toHaveAttribute('aria-selected', 'true');

    // 완주 점수판("완주를 축하합니다!") 노출 확인
    await expect(page.getByText(/완주를 축하합니다!/).first()).toBeVisible();

    // 3. 전체 탭
    await page.getByRole('tab', { name: '전체' }).click();
    await expect(page.getByRole('tab', { name: '전체' })).toHaveAttribute('aria-selected', 'true');
  });

  test('스터디 카드 클릭 시 스터디 일정 화면으로 이동', async ({ page }) => {
    await page.goto('/ko/my/joined');

    // 첫 번째 클릭 가능한 스터디 카드의 제목 링크 클릭
    const studyLink = page.locator('ul li a').first();
    await expect(studyLink).toBeVisible();
    await studyLink.click();

    // /ko/my/joined/:id/schedule 경로로 이동 확인
    await expect(page).toHaveURL(/\/ko\/my\/joined\/\d+\/schedule/);
    await expect(page.getByText(/스터디 일정 화면을 준비 중입니다\./)).toBeVisible();
  });
});
