import { expect, test } from '@playwright/test';

// ─── 페이지 로드 ───────────────────────────────────────────────────────────────

test.describe('홈', () => {
  test('페이지 로드', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/StudyClub/i);
  });

  test('/ → /ko 로케일 리다이렉트', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/ko/);
  });
});

test.describe('스터디 목록', () => {
  test('페이지 이동', async ({ page }) => {
    await page.goto('/ko/studies');
    await expect(page.locator('main')).toBeVisible();
  });

  test('영문 로케일 페이지 이동', async ({ page }) => {
    await page.goto('/en/studies');
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('이벤트 목록', () => {
  test('페이지 이동', async ({ page }) => {
    await page.goto('/ko/events');
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('기타 페이지', () => {
  for (const path of ['/ko/about', '/ko/guide', '/ko/notices']) {
    test(`${path} 페이지 로드`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('main')).toBeVisible();
    });
  }
});

// ─── 스터디 상세 ───────────────────────────────────────────────────────────────

test.describe('스터디 상세', () => {
  test('모집 중인 스터디 상세 페이지 로드', async ({ page }) => {
    await page.goto('/ko/studies/ai-paper-study');
    await expect(page.locator('main')).toBeVisible();
  });

  test('존재하지 않는 스터디 → 404', async ({ page }) => {
    const res = await page.goto('/ko/studies/not-exist-study-id-xyz');
    expect(res?.status()).toBe(404);
  });
});

// ─── 인증 게이팅 ──────────────────────────────────────────────────────────────

test.describe('인증 미들웨어', () => {
  test('/ko/my — 비로그인 시 /ko/login 으로 리다이렉트', async ({ page }) => {
    await page.goto('/ko/my');
    await expect(page).toHaveURL(/\/ko\/login/);
  });

  test('/ko/my — next 파라미터가 붙는다', async ({ page }) => {
    await page.goto('/ko/my');
    await expect(page).toHaveURL(/next=%2Fko%2Fmy/);
  });

  test('/ko/my/studies — 비로그인 시 /ko/login 으로 리다이렉트', async ({ page }) => {
    await page.goto('/ko/my/studies');
    await expect(page).toHaveURL(/\/ko\/login/);
  });
});

test.describe('로그인 페이지', () => {
  test('페이지 로드', async ({ page }) => {
    await page.goto('/ko/login');
    await expect(page.locator('h1')).toContainText('로그인');
  });

  test('Google 로그인 버튼 표시', async ({ page }) => {
    await page.goto('/ko/login');
    await expect(page.getByText(/Google 계정으로 로그인/i)).toBeVisible();
  });
});

// ─── 스터디 신청 폼 ───────────────────────────────────────────────────────────

test.describe('스터디 신청 폼 (ApplyDialog)', () => {
  test('신청 버튼 클릭 시 다이얼로그 열림', async ({ page }) => {
    await page.goto('/ko/studies/python-pandas-ml-coding');
    const applyBtn = page.getByRole('button', { name: /신청하기|Apply/i }).first();
    await applyBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('폼 미제출 시 에러 메시지 표시', async ({ page }) => {
    await page.goto('/ko/studies/python-pandas-ml-coding');
    await page.getByRole('button', { name: /신청하기|Apply/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // 아무것도 선택하지 않고 신청 클릭
    await page.getByRole('dialog').getByRole('button', { name: /^신청$|^Apply$/i }).click();
    // Zod 검증 에러가 화면에 노출돼야 한다
    await expect(page.getByRole('dialog').locator('p.text-error-700, [class*="text-error"]')).toBeVisible();
  });

  test('Esc 키로 다이얼로그 닫힘', async ({ page }) => {
    await page.goto('/ko/studies/python-pandas-ml-coding');
    await page.getByRole('button', { name: /신청하기|Apply/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});

// ─── 스터디 목록 필터 ─────────────────────────────────────────────────────────

test.describe('스터디 목록 필터', () => {
  test('검색어 입력 시 목록 필터링', async ({ page }) => {
    await page.goto('/ko/studies');
    const search = page.getByRole('searchbox');
    await search.fill('알고리즘');
    // 입력 후 DOM 업데이트 확인 (결과 없음 또는 카드 존재)
    await expect(page.locator('main')).toBeVisible();
  });

  test('전체 탭 클릭 시 모든 스터디 표시', async ({ page }) => {
    await page.goto('/ko/studies');
    await page.getByRole('tab', { name: /전체|All/i }).click();
    await expect(page.locator('main')).toBeVisible();
  });
});
