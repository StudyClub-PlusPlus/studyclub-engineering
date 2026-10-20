import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const DAY = 24 * 60 * 60 * 1000;
const at = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();

/** GET /api/me/studies 고정 응답 — 참여중 1건 · 완주 1건. 백엔드 없이 화면을 본다. */
const MY_STUDIES = {
  items: [
    {
      studyId: 101,
      title: 'E2E 참여중 스터디',
      category: 'BACKEND',
      studyKind: 'STUDY',
      startAt: at(-14),
      endAt: at(28),
      relation: 'ONGOING',
      participantStatus: 'ACTIVE',
      participantRole: 'MEMBER',
      discordChannelUrl: null,
      driveUrl: null,
      attendanceRate: 1,
      meetings: [-7, 0, 7].map((d, i) => ({
        meetingId: 1000 + i,
        sequence: i + 1,
        scheduledAt: at(d),
        startAt: null,
        endAt: null,
        attendanceStatus: d < 0 ? 'PRESENT' : null,
        countedInRate: d < 0,
      })),
    },
    {
      studyId: 102,
      title: 'E2E 완주 스터디',
      category: 'AI_ML',
      studyKind: 'STUDY',
      startAt: at(-90),
      endAt: at(-30),
      relation: 'COMPLETED',
      participantStatus: 'COMPLETED',
      participantRole: 'MEMBER',
      discordChannelUrl: null,
      driveUrl: null,
      attendanceRate: 0.5,
      meetings: [-60, -45].map((d, i) => ({
        meetingId: 2000 + i,
        sequence: i + 1,
        scheduledAt: at(d),
        startAt: null,
        endAt: null,
        attendanceStatus: i === 0 ? 'PRESENT' : 'ABSENT',
        countedInRate: true,
      })),
    },
  ],
};

// 로그인 + 온보딩 완료 사용자 세션 주입 헬퍼
async function loginAsCrew(page: Page) {
  await page.route('**/api/me/studies', (route) =>
    route.fulfill({
      json: MY_STUDIES,
      headers: {
        'Access-Control-Allow-Origin': route.request().headers()['origin'] ?? '*',
        'Access-Control-Allow-Credentials': 'true',
      },
    }),
  );
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
    await expect(page.locator('h1')).toHaveText('내 스터디룸');

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

  test('스터디 카드 클릭 시 스터디 일정 화면으로 이동 및 탭 전환', async ({ page }) => {
    await page.goto('/ko/my/joined');

    // 첫 번째 클릭 가능한 스터디 카드의 제목 링크 클릭
    const studyLink = page.locator('ul li a').first();
    await expect(studyLink).toBeVisible();
    await studyLink.click();

    // /ko/my/joined/:id/schedule 경로로 이동 확인
    await expect(page).toHaveURL(/\/ko\/my\/joined\/\d+\/schedule/);
    await expect(page.getByRole('main').getByRole('link', { name: '내 스터디룸' })).toBeVisible();
    await expect(page.getByRole('link', { name: '일정' })).toBeVisible();
    await expect(page.getByRole('link', { name: '출석' })).toBeVisible();
    await expect(page.locator('table').first()).toBeVisible();

    // 출석 탭 클릭 이동 확인
    await page.getByRole('link', { name: '출석' }).click();
    await expect(page).toHaveURL(/\/ko\/my\/joined\/\d+\/schedule\/attendance/);
    await expect(page.getByRole('heading', { level: 2, name: /출석/ })).toBeVisible();
    await expect(page.getByText('출석률')).toBeVisible();

    // 내 스터디룸 링크 클릭 시 내 스터디룸 목록으로 복귀 확인
    await page.getByRole('main').getByRole('link', { name: '내 스터디룸' }).click();
    await expect(page).toHaveURL(/\/ko\/my\/joined/);
  });
});

test.describe('내 스터디 상세 — 출석 탭 모바일 반응형', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('모바일에서 스터디 정보 카드 및 출석 테이블 렌더링 확인', async ({ page }) => {
    await loginAsCrew(page);
    await page.goto('/ko/my/joined/1/schedule/attendance');

    await expect(page.getByRole('heading', { level: 2, name: /출석/ })).toBeVisible();
    await expect(page.getByText('출석률')).toBeVisible();

    const toggleRules = page.getByRole('button', { name: '스터디 규칙' });
    await expect(toggleRules).toBeVisible();
  });
});


test.describe('내 스터디 상세 — 출석 탭 (10-18 기획 변경)', () => {
  test('닉네임 · 디스코드 닉네임 열이 있고, 「적용」 버튼 없이 출석 상태를 고르면 바로 반영된다', async ({ page }) => {
    await loginAsCrew(page);
    await page.goto('/ko/my/joined/11/schedule/attendance');

    await expect(page.getByText('닉네임', { exact: true })).toBeVisible();
    await expect(page.getByText('디스코드 닉네임', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '출석 적용' })).toHaveCount(0);

    const status = page.getByRole('combobox', { name: '바꿀 출석 상태' });
    await expect(status).toBeDisabled();

    // 0번은 머리 줄 전체 선택, 1번은 나(네비게이터), 2번부터 크루
    await page.getByRole('checkbox').nth(2).check();
    await expect(status).toBeEnabled();
    // 크루의 킥오프 칸은 비어 있다 — 「출석」을 고르면 반드시 바뀐다
    const meeting = page.getByRole('combobox', { name: '바꿀 회차' });
    await meeting.selectOption({ index: 0 });
    await status.selectOption('present');

    // 고르는 즉시 저장 전 변경이 생기고, 드롭다운은 처음 글로 돌아온다
    await expect(page.getByRole('button', { name: '변경 취소' })).toBeVisible();
    await expect(status).toHaveValue('');
  });

  test('참여 중단을 고르면 줄에 되돌리기 버튼이 붙고 작업 바에 「중단 예정 n명」이 보인다', async ({ page }) => {
    await loginAsCrew(page);
    await page.goto('/ko/my/joined/11/schedule/attendance');

    const crewBox = page.getByRole('checkbox').nth(2);
    const name = ((await crewBox.getAttribute('aria-label')) ?? '').replace(/ 선택$/, '');
    await crewBox.check();
    await page.getByRole('button', { name: '참여 중단' }).click();

    await expect(page.getByText('중단 예정 1명')).toBeVisible();
    const undo = page.getByRole('button', { name: `${name} 중단 예정 취소` });
    await expect(undo).toBeVisible();

    await undo.click();
    await expect(page.getByText('중단 예정 1명')).toHaveCount(0);
  });

  test('출석 제목 옆 「?」를 누르면 발표 표시 설명이 열린다', async ({ page }) => {
    await loginAsCrew(page);
    await page.goto('/ko/my/joined/11/schedule/attendance');

    await page.getByRole('button', { name: '발표 표시 설명' }).click();
    await expect(page.getByRole('dialog', { name: '발표 표시 설명' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: '발표 표시 설명' })).toHaveCount(0);
  });

  test('캡틴은 정보 카드에서 「백오피스 출석부」 버튼을 본다', async ({ page }) => {
    await loginAsCrew(page);
    await page.goto('/ko/my/joined/1/schedule/attendance');

    await expect(page.getByRole('button', { name: '백오피스 출석부' })).toBeVisible();
    await expect(page.getByRole('button', { name: /백오피스 출석 \(전체 참여자\)/ })).toHaveCount(0);
  });
});
