import type { Page } from '@playwright/test';

import { mockHandlerGroups } from '../../../../packages/mock/src/msw/handlers';
import { form, notice, pageOf, study, template, users } from '../../screen-catalog/features/prd/fixtures';
import type { Recipe } from '../../screen-catalog/types';

/** Per-context fixtures keep error/empty states independent of MSW defaults and each other. */
export async function stubPrd(page: Page, overrides: NonNullable<Recipe['api']>) {
  const config = Object.fromEntries(
    mockHandlerGroups.flatMap((group) =>
      group.handlers.flatMap((handler) => {
        const path = handler.path.replace(/^https?:\/\/[^/]+/, '');
        return ['', 'http://localhost:8080'].map((origin) => [
          `${handler.method}:${origin}${path}`,
          { enabled: false, presetLabel: handler.presets[0].label },
        ]);
      }),
    ),
  );
  await page.addInitScript((value) => localStorage.setItem('msw-handler-config', JSON.stringify(value)), config);
  await page.clock.setFixedTime(new Date('2026-10-31T03:00:00Z'));
  const defaults: NonNullable<Recipe['api']> = [
    { path: '/api/admin/studies/20', json: study },
    { path: '/api/admin/studies/20/application-form', json: form },
    {
      path: '/api/admin/study-programs',
      json: { items: [{ programId: 20, title: study.programTitle, latestStudyId: 20 }] },
    },
    { path: '/api/admin/users', json: pageOf(users) },
    { path: '/api/admin/notification-templates', json: [template] },
    { path: '/api/admin/notices', json: pageOf([notice]) },
    { path: '/api/admin/notices/1', json: notice },
  ];
  const unexpected: string[] = [];
  // Pending responses stay unresolved until teardown, so loading/saving snapshots cannot race a timeout.
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  page.once('close', release);
  await page.context().route('**/api/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204 });
    const url = new URL(request.url());
    const path = url.pathname;
    const fixture = [...overrides, ...defaults].find(
      (f) => f.path === path && (f.method ?? 'GET') === request.method() && Object.entries(f.query ?? {}).every(([key, value]) => url.searchParams.get(key) === value),
    );
    if (!fixture) {
      unexpected.push(`${request.method()} ${path}`);
      return route.fulfill({
        status: 501,
        json: { errorCode: 'UNMOCKED', errorMessage: '카탈로그 응답이 정의되지 않았습니다.' },
      });
    }
    if (fixture.pending) {
      await pending;
      return;
    }
    return route.fulfill({ status: fixture.status ?? 200, json: fixture.json });
  });
  return unexpected;
}
