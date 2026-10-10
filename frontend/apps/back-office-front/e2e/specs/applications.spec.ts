import { expect, test } from '@playwright/test';

import type { ApplicationsResponse } from '../../src/features/applications/types';

function applicationsResponse(): ApplicationsResponse {
  return {
    respondentCount: 2,
    capacity: 2,
    canApprove: true,
    approvalBlockedReason: null,
    announcementUrl: 'https://example.com/studies/107',
    questions: [{ id: 'reason', label: '지원 이유', type: 'TEXTAREA', options: null, allowOther: null }],
    applications: [1, 2].map((id) => ({
      id,
      recruitmentId: 1,
      status: 'PENDING',
      applicantName: `신청자${id}`,
      discordNickname: `별명${id}`,
      email: `member${id}@example.com`,
      submittedAt: '2026-10-08T23:30:00Z',
      previousParticipationCount: id - 1,
      completionRate: id === 1 ? null : 0,
      availableDays: ['mon'],
      scheduleAgreed: true,
      answers: { reason: '<img src=x onerror="window.injected=true">' + '긴답변'.repeat(100) },
    })),
  };
}

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: 'bo_access_token', value: 'test-only', url: baseURL! }]);
  await context.addInitScript(() =>
    localStorage.setItem(
      'msw-handler-config',
      JSON.stringify({ 'GET:/api/admin/studies/:id': { enabled: false, presetLabel: '정상' } }),
    ),
  );
});

test('신청서 조회·선택·승인·거절, 새로고침, 모바일 및 답변의 HTML 이스케이프', async ({ page, context }) => {
  const response = applicationsResponse();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.route('**/api/admin/studies/107**', async (route) => {
    const request = route.request();
    if (request.url().endsWith('/decisions')) {
      const payload = request.postDataJSON();
      response.applications.forEach((application) => {
        if (payload.applicationIds.includes(application.id)) application.status = payload.decision;
      });
      await route.fulfill({ status: 204 });
    } else if (request.url().endsWith('/applications')) {
      await route.fulfill({ json: response });
    } else {
      await route.fulfill({
        json: {
          id: 107,
          title: '심사 테스트',
          oneLineSummary: '테스트 요약',
          category: 'AI_ML',
          studyKind: 'STUDY',
          status: 'OPEN',
          recruitStatus: 'RECRUITING',
          capacity: 2,
        },
      });
    }
  });
  await page.goto('/studies/107?tab=crew');
  await expect(page.getByRole('tab', { name: '대기 2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '신청자1 신청서 펼치기' }).click();
  await expect(page.getByText('지원 이유', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => 'injected' in window)).toBe(false);
  await expect(page.locator('section[aria-label="신청자 심사"] img')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: '신청자1 승인', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('1명의 신청을 승인했습니다.');
  await page.getByRole('checkbox', { name: '대기 신청 전체 선택' }).check();
  await page.getByRole('button', { name: '일괄 거절', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('1명의 신청을 거절했습니다.');
  await page.goto('/studies/107/applicants');
  await page.getByRole('tab', { name: '승인 1', exact: true }).click();
  await expect(page.getByText('신청자1', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '신청자1 거절', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('tab', { name: '거절 1', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('담당 권한이 회수되면 심사 화면에서 개인정보를 숨긴다', async ({ page, context }) => {
  let forbidden = false;
  await context.route('**/api/admin/studies/107**', async (route) => {
    if (route.request().url().endsWith('/decisions')) {
      forbidden = true;
      await route.fulfill({ status: 403, json: {} });
      return;
    }
    if (forbidden && route.request().url().endsWith('/applications')) return;
    if (route.request().url().includes('/applications')) {
      await route.fulfill({ status: forbidden ? 403 : 200, json: forbidden ? {} : applicationsResponse() });
    } else await route.fulfill({ json: { id: 107, title: '심사 테스트' } });
  });
  await page.goto('/studies/107/applicants');
  await page.getByRole('button', { name: '신청자1 승인', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '담당하는' })).toHaveText('담당하는 스터디가 아니에요.');
  await expect(page.getByText('member1@example.com')).toHaveCount(0);
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('정원 충돌은 실패로 알리고 최신 승인 가능 여부를 반영한다', async ({ page, context }) => {
  const response = applicationsResponse();
  await context.route('**/api/admin/studies/107**', async (route) => {
    if (route.request().url().endsWith('/decisions')) {
      response.canApprove = false;
      response.approvalBlockedReason = '추가 승인 불가';
      await route.fulfill({ status: 409, json: {} });
    } else if (route.request().url().endsWith('/applications')) await route.fulfill({ json: response });
    else await route.fulfill({ json: { id: 107, title: '심사 테스트' } });
  });
  await page.goto('/studies/107/applicants');
  await page.getByRole('button', { name: '신청자1 승인', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '신청 상태' })).toContainText(
    '신청 상태 또는 정원이 변경되었습니다',
  );
  await expect(page.getByRole('button', { name: '신청자1 승인', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '신청자1 거절', exact: true })).toBeEnabled();
});

test('다른 탭의 로그아웃과 계정 변경이 열린 신청자 화면을 차단한다', async ({ page, context }) => {
  await context.route('**/api/admin/studies/107**', (route) =>
    route.fulfill({
      json: route.request().url().endsWith('/applications')
        ? applicationsResponse()
        : { id: 107, title: '심사 테스트' },
    }),
  );
  await page.goto('/studies/107/applicants');
  await page.evaluate(() =>
    localStorage.setItem(
      'bo_user',
      JSON.stringify({ id: 1, email: 'first@example.com', nickname: '첫 계정', picture: null, role: 'ADMIN' }),
    ),
  );
  const otherPage = await context.newPage();
  await otherPage.goto('/studies/107/applicants');
  await expect(otherPage.getByText('member1@example.com')).toBeVisible();
  await page.evaluate(() => localStorage.removeItem('bo_user'));
  await expect(otherPage.getByRole('alert').filter({ hasText: '다른 탭' })).toBeVisible();
  await expect(otherPage.getByText('member1@example.com')).toHaveCount(0);
  await expect(otherPage.getByRole('button', { name: '신청자1 승인', exact: true })).toHaveCount(0);
  await otherPage.reload();
  await expect(otherPage.getByText('member1@example.com')).toBeVisible();
  await page.evaluate(() =>
    localStorage.setItem(
      'bo_user',
      JSON.stringify({ id: 2, email: 'second@example.com', nickname: '다음 계정', picture: null, role: 'ADMIN' }),
    ),
  );
  await expect(otherPage.getByRole('alert').filter({ hasText: '다른 탭' })).toBeVisible();
  await expect(otherPage.getByRole('table')).toHaveCount(0);
});

test('승인 응답이 유실되면 재조회가 완료되기 전까지 재처리를 막는다', async ({ page, context }) => {
  const response = applicationsResponse();
  let decisions = 0;
  let releaseRefresh!: () => void;
  const refreshGate = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });
  await context.route('**/api/admin/studies/107**', async (route) => {
    if (route.request().url().endsWith('/decisions')) {
      decisions += 1;
      response.applications[0].status = 'APPROVED';
      await route.abort('failed');
    } else if (route.request().url().endsWith('/applications')) {
      if (decisions > 0) await refreshGate;
      await route.fulfill({ json: response });
    } else await route.fulfill({ json: { id: 107, title: '심사 테스트' } });
  });
  await page.goto('/studies/107/applicants');
  await page.getByRole('button', { name: '신청자1 승인', exact: true }).click();
  await expect(page.getByRole('button', { name: '신청자1 승인', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '신청자1 거절', exact: true })).toBeDisabled();
  releaseRefresh();
  await expect(page.getByRole('tab', { name: '승인 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '신청자1 승인', exact: true })).toHaveCount(0);
  expect(decisions).toBe(1);
});

test('응답 유실 후 재조회도 실패하면 심사 버튼을 숨기고 조회부터 재시도한다', async ({ page, context }) => {
  const response = applicationsResponse();
  let decisions = 0;
  let refreshFailed = false;
  await context.route('**/api/admin/studies/107**', async (route) => {
    if (route.request().url().endsWith('/decisions')) {
      decisions += 1;
      response.applications[0].status = 'APPROVED';
      await route.abort('failed');
    } else if (route.request().url().endsWith('/applications')) {
      if (decisions > 0 && !refreshFailed) {
        refreshFailed = true;
        await route.fulfill({ status: 500, json: {} });
      } else await route.fulfill({ json: response });
    } else await route.fulfill({ json: { id: 107, title: '심사 테스트' } });
  });
  await page.goto('/studies/107/applicants');
  await page.getByRole('button', { name: '신청자1 승인', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '신청자를 불러오지 못했습니다' })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByRole('button', { name: '다시 시도', exact: true }).click();
  await expect(page.getByRole('tab', { name: '승인 1', exact: true })).toBeVisible();
  expect(decisions).toBe(1);
});
