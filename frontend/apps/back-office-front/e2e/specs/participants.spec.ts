import { expect, test, type BrowserContext, type Route } from '@playwright/test';

import { studyDetailFixture } from '../fixtures/study-detail';
// PRD 부분 연결: BO-ST-025-S01/S02, BO-ST-026-S02 (반 편성·저장·이탈 일부)
// 전체 대응표: docs/frontend-development-guide/admin-e2e-prd-map.md

const study = studyDetailFixture({
  id: 20,
  programId: 1,
  programTitle: '백오피스 테스트',
  title: '백엔드 스터디',
  oneLineSummary: '참여자 반 편성',
  description: null,
  category: 'AI_ML',
  studyKind: 'STUDY',
  thumbnailUrl: null,
  status: 'OPEN',
  recruitStatus: 'RECRUITING',
  curriculum: null,
  capacity: 10,
  schedule: null,
  recruitDeadlineAt: null,
  startAt: null,
  endAt: null,
  discordChannelUrl: null,
  driveUrl: null,
});

function participants() {
  return {
    studyId: 20,
    participantCount: 3,
    recruitmentCapacity: 10,
    groups: [
      { groupId: 1, name: '기본반', isDefault: true, canDelete: false },
      { groupId: 2, name: '목요일반', isDefault: false, canDelete: false },
      { groupId: 3, name: '금요일반', isDefault: false, canDelete: true },
    ],
    participants: [
      {
        participantId: 41,
        accountId: 1,
        nickname: '김크루',
        discordNickname: 'crew/서울',
        email: 'crew@example.com',
        regionGroup: 'KR',
        groupId: 1,
        participantRole: 'MEMBER',
        status: 'ACTIVE',
        captain: false,
        joinedAt: '2026-10-01T00:00:00Z',
      },
      {
        participantId: 42,
        accountId: 2,
        nickname: '이네비',
        discordNickname: 'navigator/미국',
        email: 'navigator@example.com',
        regionGroup: 'NA',
        groupId: 1,
        participantRole: 'LEADER',
        status: 'PAUSED',
        captain: false,
        joinedAt: '2026-10-01T00:00:00Z',
      },
      {
        participantId: 43,
        accountId: 3,
        nickname: '박캡틴',
        discordNickname: null,
        email: 'captain@example.com',
        regionGroup: 'KR',
        groupId: 2,
        participantRole: 'MEMBER',
        status: 'ACTIVE',
        captain: true,
        joinedAt: '2026-10-01T00:00:00Z',
      },
    ],
  };
}

test.beforeEach(async ({ context, baseURL }) => {
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
});

async function mockParticipants(
  context: BrowserContext,
  onSave?: (route: Route, response: ReturnType<typeof participants>) => Promise<void>,
) {
  const response = participants();
  const writes: unknown[] = [];
  await context.route('**/api/admin/studies/20**', async (route) => {
    const request = route.request();
    const url = new URL(request.url()).pathname;
    const method = request.method();
    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': request.headers().origin ?? '*',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
      return;
    }
    if (url.endsWith('/application-form')) {
      await route.fulfill({ json: { studyId: 20, title: '신청 폼', description: null, questions: [] } });
      return;
    }
    if (url.endsWith('/participants')) {
      if (method === 'GET') {
        await route.fulfill({ json: response });
        return;
      }
      if (onSave) {
        await onSave(route, response);
        return;
      }
      const body = request.postDataJSON() as { changes: { participantId: number; groupId: number }[] };
      writes.push({ method, body });
      for (const change of body.changes) {
        const participant = response.participants.find((p) => p.participantId === change.participantId)!;
        participant.groupId = change.groupId;
      }
      await route.fulfill({ json: { participants: response.participants } });
      return;
    }
    if (url.endsWith('/groups') && method === 'POST') {
      const group = { groupId: 4, name: request.postDataJSON().name as string, isDefault: false, canDelete: true };
      response.groups.push(group);
      await route.fulfill({ status: 201, json: group });
      return;
    }
    if (/\/groups\/\d+$/.test(url) && method === 'PATCH') {
      const group = response.groups.find((g) => url.endsWith('/' + g.groupId))!;
      group.name = request.postDataJSON().name;
      await route.fulfill({ json: group });
      return;
    }
    if (/\/groups\/\d+$/.test(url) && method === 'DELETE') {
      response.groups = response.groups.filter((g) => !url.endsWith('/' + g.groupId));
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fulfill({ json: study });
  });
  return writes;
}

test('참여자 반 편성: 반 생성·수정·삭제와 일괄 이동을 저장한다', async ({ page, context }) => {
  const writes = await mockParticipants(context);
  await page.goto('/studies/20?tab=crew');
  await expect(page.getByRole('heading', { name: '반 3개' })).toBeVisible();
  await expect(page.getByText('기본', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '기본반 삭제' })).toBeDisabled();
  await expect(page.getByText('박캡틴')).toBeVisible();

  await page.getByRole('button', { name: '반 추가' }).click();
  await page.getByRole('textbox', { name: '반 제목' }).fill('토요일반');
  await page.getByRole('region', { name: '반 편성' }).getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('button', { name: '토요일반 수정' })).toBeVisible();
  await page.getByRole('button', { name: '토요일반 수정' }).click();
  await page.getByRole('textbox', { name: '반 제목' }).fill('주말반');
  await page.getByRole('region', { name: '반 편성' }).getByRole('button', { name: '저장' }).click();
  await page.getByRole('button', { name: '주말반 삭제' }).click();
  await page.getByRole('button', { name: '삭제하기' }).click();
  await expect(page.getByRole('button', { name: '주말반 삭제' })).toHaveCount(0);

  await page.getByRole('checkbox', { name: '김크루 선택' }).check();
  await page.getByRole('checkbox', { name: '박캡틴 선택' }).check();
  await page.getByRole('combobox', { name: '바꿀 반' }).selectOption('3');
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
  await page.screenshot({ path: 'test-results/participants-assignment.png', fullPage: true });
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('저장했습니다.');

  expect(writes).toContainEqual({
    method: 'PATCH',
    body: {
      changes: [
        { participantId: 41, groupId: 3 },
        { participantId: 43, groupId: 3 },
      ],
    },
  });
});

test('저장 중 이동을 막고 권한 회수 응답이면 명단을 숨긴다', async ({ page, context }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await mockParticipants(context, async (route) => {
    await gate;
    await route.fulfill({ status: 403, json: { errorMessage: '권한이 없습니다.' } });
  });
  await page.goto('/studies/20?tab=crew');
  await page.getByRole('combobox', { name: '김크루 반' }).selectOption('3');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('button', { name: '정보', exact: true })).toBeDisabled();
  await page.getByRole('link', { name: '스터디 관리', exact: true }).click();
  await expect(page).toHaveURL(/tab=crew/);
  await expect(page.getByRole('dialog', { name: '변경을 취소하고 이동' })).toBeVisible();
  await expect(page.getByRole('button', { name: '변경 취소 후 이동' })).toBeDisabled();
  release();
  await expect(page.getByRole('alert').filter({ hasText: '권한' })).toBeVisible();
  await expect(page.getByText('crew@example.com', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('저장 응답이 유실되어도 변경을 보존하고 재시도한다', async ({ page, context }) => {
  let attempts = 0;
  await mockParticipants(context, async (route, response) => {
    attempts++;
    const body = route.request().postDataJSON() as { changes: { participantId: number; groupId: number }[] };
    for (const change of body.changes)
      response.participants.find((p) => p.participantId === change.participantId)!.groupId = change.groupId;
    if (attempts === 1) await route.abort('failed');
    else await route.fulfill({ json: { participants: response.participants } });
  });
  await page.goto('/studies/20?tab=crew');
  await page.getByRole('combobox', { name: '김크루 반' }).selectOption('3');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '저장하지 못했습니다' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: '김크루 반' })).toHaveValue('3');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('저장했습니다.');
  expect(attempts).toBe(2);
});

for (const direction of ['back', 'forward'] as const) {
  test(`브라우저 ${direction} 이동을 취소하면 변경을 유지하고 확인하면 이동한다`, async ({ page, context }) => {
    await mockParticipants(context);
    await page.goto('/studies/20?tab=crew');
    await expect(page.getByRole('combobox', { name: '김크루 반' })).toBeVisible();
    if (direction === 'back') {
      await page.evaluate(() => {
        history.replaceState(history.state, '', '?tab=info');
        history.pushState(history.state, '', '?tab=crew');
      });
    } else {
      await page.evaluate(() => history.pushState(history.state, '', '?tab=info'));
      await expect(page).toHaveURL(/tab=info/);
      await page.goBack();
    }
    await page.getByRole('combobox', { name: '김크루 반' }).selectOption('3');
    await page.evaluate((direction) => history[direction](), direction);
    await expect(page.getByRole('dialog', { name: '변경을 취소하고 이동' })).toBeVisible();
    await expect(page).toHaveURL(/tab=crew/);
    await page.getByRole('button', { name: '계속 편집' }).click();
    await expect(page.getByRole('combobox', { name: '김크루 반' })).toHaveValue('3');
    await page.evaluate((direction) => history[direction](), direction);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page).toHaveURL(/tab=crew/);
    await page.getByRole('button', { name: '변경 취소 후 이동' }).click();
    await expect(page).toHaveURL(/tab=info/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}

test('응답 유실 후 재조회로 저장이 확인되면 불필요한 변경을 정리한다', async ({ page, context }) => {
  await page.clock.install();
  await mockParticipants(context, async (route, response) => {
    response.participants[0]!.groupId = 3;
    await route.abort('failed');
  });
  await page.goto('/studies/20?tab=crew');
  await page.getByRole('combobox', { name: '김크루 반' }).selectOption('3');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '저장하지 못했습니다' })).toBeVisible();
  await page.clock.fastForward(61_000);
  await context.setOffline(true);
  await context.setOffline(false);
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: '김크루 반' })).toHaveValue('3');
  await expect(page.getByRole('button', { name: '변경 취소', exact: true })).toHaveCount(0);
});
